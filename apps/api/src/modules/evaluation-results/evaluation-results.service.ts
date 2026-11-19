import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { ProposalsService } from '../proposals/proposals.service.js';
import { AdminReviewService } from '../admin-review/admin-review.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationEventsService } from '../notification-events/notification-events.service.js';
import { EvaluationResultDto } from './evaluation-result.dto.js';

@Injectable()
export class EvaluationResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
    private readonly publication: AdminReviewService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationEventsService,
  ) {}

  async apply(input: EvaluationResultDto, key: string) {
    input = plainToInstance(EvaluationResultDto, input);
    if (
      !key?.trim() ||
      key.length > 180 ||
      validateSync(input, { whitelist: true, forbidNonWhitelisted: true })
        .length
    )
      throw new BadRequestException({
        codigo: 'EVALUACION_INVALIDA',
        mensaje:
          'La evaluación debe cumplir el contrato y tener una clave de evento.',
      });
    return this.prisma.client.$transaction(async (tx) => {
      const initial = await tx.propuesta.findUnique({
        where: { id_propuesta: input.id_propuesta },
        select: { id_proponente: true },
      });
      if (!initial)
        throw new NotFoundException({
          codigo: 'PROPUESTA_NO_ENCONTRADA',
          mensaje: 'La propuesta no existe.',
        });
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${initial.id_proponente}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id_propuesta FROM propuesta WHERE id_propuesta = ${input.id_propuesta}::uuid FOR UPDATE`;
      const row = await tx.propuesta.findUniqueOrThrow({
        where: { id_propuesta: input.id_propuesta },
        include: { categoria: true, actividad: true },
      });
      if (row.version_actual !== input.version_propuesta)
        throw new ConflictException({
          codigo: 'VERSION_DESACTUALIZADA',
          mensaje: 'La evaluación corresponde a otra versión de la propuesta.',
        });
      const previous = await tx.evaluacionIa.findUnique({
        where: { evento_clave: key },
      });
      if (previous) {
        const indicators = previous.indicadores_json as Record<string, unknown>;
        if (
          previous.id_propuesta !== input.id_propuesta ||
          previous.version_propuesta !== input.version_propuesta ||
          previous.resultado !== input.resultado ||
          previous.respuesta_valida !== input.respuesta_valida ||
          previous.version_politica !== input.version_politica ||
          previous.razones !== (input.razones ?? null) ||
          !Object.entries(input.indicadores_json).every(
            ([name, value]) => indicators[name] === value,
          )
        )
          throw new ConflictException({
            codigo: 'EVENTO_REUTILIZADO',
            mensaje: 'La clave ya corresponde a otra evaluación.',
          });
        return {
          id_evaluacion: previous.id_evaluacion,
          id_propuesta: row.id_propuesta,
          estado: row.estado,
        };
      }
      if (row.estado !== 'pendiente_evaluacion' && row.estado !== 'en_revision')
        throw new ConflictException({
          codigo: 'PROPUESTA_YA_RESUELTA',
          mensaje: 'La propuesta ya tiene una resolución.',
        });
      const evaluation = await tx.evaluacionIa.create({
        data: {
          id_propuesta: row.id_propuesta,
          version_propuesta: row.version_actual,
          resultado: input.resultado,
          indicadores_json: instanceToPlain(input.indicadores_json),
          razones: input.razones ?? null,
          respuesta_valida: input.respuesta_valida,
          version_politica: input.version_politica,
          evento_clave: key,
          contenido_evaluado_json: { ...this.proposals.toEvaluable(row) },
        },
      });
      const favorable =
        row.estado === 'pendiente_evaluacion' &&
        input.resultado === 'favorable' &&
        input.respuesta_valida &&
        Object.values(input.indicadores_json).every((value) => value === false);
      let estado: 'aprobada' | 'en_revision' = 'en_revision';
      let motivo =
        input.razones || 'La evaluación requiere revisión administrativa.';
      if (favorable) {
        try {
          await tx.propuesta.update({
            where: { id_propuesta: row.id_propuesta },
            data: { estado: 'aprobada' },
          });
          await this.publication.createPublishedActivityIfApproved(
            tx,
            { ...row, estado: 'aprobada' },
            'Evaluación favorable y controles objetivos válidos.',
          );
          estado = 'aprobada';
          motivo = 'Evaluación favorable y controles objetivos válidos.';
        } catch (error) {
          if (!(error instanceof HttpException)) throw error;
          motivo =
            'La propuesta necesita revisión de los controles de publicación.';
        }
      }
      await tx.propuesta.update({
        where: { id_propuesta: row.id_propuesta },
        data: { estado },
      });
      await this.audit.record(
        {
          entidad_afectada: 'propuesta',
          identificador_afectado: row.id_propuesta,
          accion: 'evaluacion_aplicada',
          estado_anterior: row.estado,
          estado_nuevo: estado,
          motivo,
          evento_clave: `evaluacion:${evaluation.id_evaluacion}:aplicada`,
        },
        tx,
      );
      if (estado === 'en_revision')
        await this.notifications.enqueue(
          {
            evento_clave: `propuesta:${row.id_propuesta}:v${row.version_actual}:en_revision:${row.id_proponente}`,
            tipo_evento: 'propuesta_en_revision',
            id_destinatario: row.id_proponente,
            id_propuesta: row.id_propuesta,
            titulo: 'Tu propuesta está en revisión',
            mensaje: motivo,
            ocurrido_en: new Date().toISOString(),
          },
          tx,
        );
      return {
        id_evaluacion: evaluation.id_evaluacion,
        id_propuesta: row.id_propuesta,
        estado,
      };
    });
  }
}
