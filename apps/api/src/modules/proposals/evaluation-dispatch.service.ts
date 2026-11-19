import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PropuestaEvaluable } from '@minka/contracts';
import type { SolicitudEvaluacion } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { EvaluationGateway } from './evaluation.gateway.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationEventsService } from '../notification-events/notification-events.service.js';

@Injectable()
export class EvaluationDispatchService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EvaluationGateway,
    private readonly audit: AuditService,
    private readonly notifications: NotificationEventsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => {
        void this.dispatchOne().catch(() => {
          /* La solicitud queda persistida para el siguiente intento. */
        });
      }, 5000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async dispatchOne(): Promise<boolean> {
    if (!this.gateway.isConfigured()) return false;
    const token = randomUUID();
    const solicitud = await this.prisma.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SolicitudEvaluacion[]>`
        SELECT envio.* FROM solicitud_evaluacion AS envio
        JOIN propuesta AS propuesta_actual ON propuesta_actual.id_propuesta = envio.id_propuesta
        WHERE (envio.estado = 'pendiente' OR (envio.estado = 'enviando' AND envio.reclamo_hasta < NOW()))
          AND propuesta_actual.version_actual = envio.version_propuesta
          AND propuesta_actual.estado = 'pendiente_evaluacion'
        ORDER BY envio.creada_en, envio.id_solicitud FOR UPDATE OF envio SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.solicitudEvaluacion.update({
        where: { id_solicitud: rows[0].id_solicitud },
        data: {
          estado: 'enviando',
          token_reclamo: token,
          reclamo_hasta: new Date(Date.now() + 30000),
          intentos: { increment: 1 },
        },
      });
    });
    if (!solicitud) return false;

    try {
      await this.gateway.submit(
        solicitud.contenido_json as unknown as PropuestaEvaluable,
        solicitud.evento_clave,
      );
      await this.prisma.client.solicitudEvaluacion.updateMany({
        where: {
          id_solicitud: solicitud.id_solicitud,
          token_reclamo: token,
          estado: 'enviando',
        },
        data: {
          estado: 'entregada',
          entregada_en: new Date(),
          reclamo_hasta: null,
          token_reclamo: null,
          ultimo_error: null,
        },
      });
    } catch {
      await this.prisma.client.$transaction(async (tx) => {
        const updated = await tx.solicitudEvaluacion.updateMany({
          where: {
            id_solicitud: solicitud.id_solicitud,
            token_reclamo: token,
            estado: 'enviando',
          },
          data: {
            estado: 'requiere_revision',
            ultimo_error:
              'No se pudo confirmar una entrega válida al servicio de evaluación.',
            reclamo_hasta: null,
            token_reclamo: null,
          },
        });
        if (updated.count) {
          const derived = await tx.propuesta.updateMany({
            where: {
              id_propuesta: solicitud.id_propuesta,
              version_actual: solicitud.version_propuesta,
              estado: 'pendiente_evaluacion',
            },
            data: { estado: 'en_revision' },
          });
          if (derived.count) {
            await this.audit.record(
              {
                entidad_afectada: 'propuesta',
                identificador_afectado: solicitud.id_propuesta,
                accion: 'evaluacion_derivada',
                estado_anterior: 'pendiente_evaluacion',
                estado_nuevo: 'en_revision',
                motivo:
                  'No se pudo confirmar una entrega válida al servicio de evaluación.',
                evento_clave: `${solicitud.evento_clave}:fallo_entrega`,
              },
              tx,
            );
            const propuesta = await tx.propuesta.findUniqueOrThrow({
              where: { id_propuesta: solicitud.id_propuesta },
            });
            await this.notifications.enqueue(
              {
                evento_clave: `${solicitud.evento_clave}:en_revision:${propuesta.id_proponente}`,
                tipo_evento: 'propuesta_en_revision',
                id_destinatario: propuesta.id_proponente,
                id_propuesta: propuesta.id_propuesta,
                titulo: 'Tu propuesta está en revisión',
                mensaje:
                  'Un administrador revisará tu propuesta porque no se pudo confirmar la evaluación.',
                ocurrido_en: new Date().toISOString(),
              },
              tx,
            );
          }
        }
      });
    }
    return true;
  }
}
