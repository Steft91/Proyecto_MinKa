import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type {
  PropuestaRevision,
  RevisionResuelta,
  SesionActual,
} from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import { AccessControlService } from '../access-control/access-control.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ProposalsService } from '../proposals/proposals.service.js';
import { CODIGOS_CATEGORIA } from '../catalog/categories.js';
import { AdminDecisionDto } from './admin-review.dto.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationEventsService } from '../notification-events/notification-events.service.js';

type PublicationRow = Prisma.PropuestaGetPayload<{
  include: { categoria: true; actividad: true };
}>;

@Injectable()
export class AdminReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly proposals: ProposalsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationEventsService,
  ) {}

  async listPending(sesion?: SesionActual): Promise<PropuestaRevision[]> {
    this.access.assertAdmin(await this.proposals.getCurrentSession(sesion));
    const rows = await this.prisma.client.propuesta.findMany({
      where: { estado: 'en_revision' },
      orderBy: [{ creada_en: 'asc' }, { id_propuesta: 'asc' }],
      select: { id_propuesta: true },
    });
    return Promise.all(
      rows.map((row) => this.getDetail(sesion, row.id_propuesta)),
    );
  }

  async getDetail(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<PropuestaRevision> {
    this.access.assertAdmin(await this.proposals.getCurrentSession(sesion));
    const row = await this.prisma.client.propuesta.findUnique({
      where: { id_propuesta: id },
      include: {
        categoria: true,
        evaluaciones: { orderBy: { registrada_en: 'desc' } },
        solicitudes_evaluacion: true,
      },
    });
    if (!row)
      throw new NotFoundException({
        codigo: 'PROPUESTA_NO_ENCONTRADA',
        mensaje: 'La propuesta no existe.',
      });
    const evaluation = row.evaluaciones.find(
      (item) => item.version_propuesta === row.version_actual,
    );
    return {
      ...this.proposals.toOwnProposal(row),
      evaluacion: evaluation
        ? {
            id_evaluacion: evaluation.id_evaluacion,
            resultado: evaluation.resultado,
            razones: evaluation.razones,
            respuesta_valida: evaluation.respuesta_valida,
            version_propuesta: evaluation.version_propuesta,
            version_politica: evaluation.version_politica,
            indicadores_json: evaluation.indicadores_json,
          }
        : null,
      motivo_derivacion:
        row.solicitudes_evaluacion.find(
          (item) => item.version_propuesta === row.version_actual,
        )?.ultimo_error ?? null,
    };
  }

  async decide(
    sesion: SesionActual | undefined,
    id: string,
    input: AdminDecisionDto,
  ): Promise<RevisionResuelta> {
    this.access.assertAdmin(sesion);
    input = plainToInstance(AdminDecisionDto, input);
    if (
      validateSync(input, { whitelist: true, forbidNonWhitelisted: true })
        .length
    )
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'La decisión requiere una versión válida y un motivo.',
      });
    return this.prisma.client.$transaction(async (tx) => {
      const initial = await tx.propuesta.findUnique({
        where: { id_propuesta: id },
        select: { id_proponente: true },
      });
      if (!initial)
        throw new NotFoundException({
          codigo: 'PROPUESTA_NO_ENCONTRADA',
          mensaje: 'La propuesta no existe.',
        });
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario IN (${sesion.id_usuario}::uuid, ${initial.id_proponente}::uuid) ORDER BY id_usuario FOR UPDATE`;
      this.access.assertAdmin(
        await this.proposals.getCurrentSession(sesion, tx),
      );
      await tx.$queryRaw`SELECT id_propuesta FROM propuesta WHERE id_propuesta = ${id}::uuid FOR UPDATE`;
      const row = await tx.propuesta.findUnique({
        where: { id_propuesta: id },
        include: {
          categoria: true,
          actividad: true,
          evaluaciones: { orderBy: { registrada_en: 'desc' } },
        },
      });
      if (!row)
        throw new NotFoundException({
          codigo: 'PROPUESTA_NO_ENCONTRADA',
          mensaje: 'La propuesta no existe.',
        });
      if (row.version_actual !== input.version_propuesta)
        throw new ConflictException({
          codigo: 'VERSION_DESACTUALIZADA',
          mensaje:
            'La propuesta cambió. Recarga su información antes de decidir.',
        });
      const decision = input.decision === 'aprobar' ? 'aprobada' : 'rechazada';
      const previous = await tx.revisionAdministrativa.findUnique({
        where: {
          id_propuesta_version_propuesta: {
            id_propuesta: id,
            version_propuesta: row.version_actual,
          },
        },
      });
      if (previous) {
        if (
          previous.id_administrador !== sesion.id_usuario ||
          previous.decision !== decision ||
          previous.motivo !== input.motivo
        )
          throw new ConflictException({
            codigo: 'DECISION_YA_REGISTRADA',
            mensaje: 'Esta versión ya tiene una decisión registrada.',
          });
        return {
          id_revision: previous.id_revision,
          id_propuesta: id,
          estado: previous.decision,
          id_actividad: row.actividad?.id_actividad ?? null,
        };
      }
      if (row.estado !== 'en_revision')
        throw new ConflictException({
          codigo: 'PROPUESTA_NO_REVISABLE',
          mensaje: 'La propuesta no está pendiente de revisión administrativa.',
        });
      const evaluable = this.proposals.toEvaluable(row);
      let actividadId: string | null = null;
      if (decision === 'aprobada') {
        await tx.propuesta.update({
          where: { id_propuesta: id },
          data: { estado: 'aprobada' },
        });
        actividadId = (
          await this.createPublishedActivityIfApproved(
            tx,
            { ...row, estado: 'aprobada' },
            input.motivo,
            sesion.id_usuario,
          )
        ).id_actividad;
      }
      const evaluation = row.evaluaciones.find(
        (item) => item.version_propuesta === row.version_actual,
      );
      const revision = await tx.revisionAdministrativa.create({
        data: {
          id_propuesta: id,
          id_evaluacion: evaluation?.id_evaluacion,
          id_administrador: sesion.id_usuario,
          decision,
          motivo: input.motivo,
          version_propuesta: row.version_actual,
          contenido_revisado_json: { ...evaluable },
        },
      });
      await tx.propuesta.update({
        where: { id_propuesta: id },
        data: { estado: decision },
      });
      await this.audit.record(
        {
          id_actor: sesion.id_usuario,
          entidad_afectada: 'propuesta',
          identificador_afectado: id,
          accion: 'revision_administrativa',
          estado_anterior: 'en_revision',
          estado_nuevo: decision,
          motivo: input.motivo,
          evento_clave: `propuesta:${id}:v${row.version_actual}:decision`,
        },
        tx,
      );
      if (decision === 'rechazada')
        await this.notifications.enqueue(
          {
            evento_clave: `propuesta:${id}:v${row.version_actual}:rechazada:${row.id_proponente}`,
            tipo_evento: 'propuesta_rechazada',
            id_destinatario: row.id_proponente,
            id_propuesta: id,
            titulo: 'Tu propuesta fue rechazada',
            mensaje: input.motivo,
            ocurrido_en: new Date().toISOString(),
          },
          tx,
        );
      return {
        id_revision: revision.id_revision,
        id_propuesta: id,
        estado: decision,
        id_actividad: actividadId,
      };
    });
  }

  async createPublishedActivityIfApproved(
    tx: Prisma.TransactionClient,
    row: PublicationRow,
    motivo: string,
    actorId?: string,
  ) {
    if (row.estado !== 'aprobada')
      throw new ConflictException({
        codigo: 'PROPUESTA_NO_APROBADA',
        mensaje: 'La propuesta requiere aprobación antes de publicarse.',
      });
    if (row.actividad)
      throw new ConflictException({
        codigo: 'ACTIVIDAD_YA_PUBLICADA',
        mensaje:
          'Esta propuesta ya tiene una actividad y requiere el flujo de cambios.',
      });
    const evaluable = this.proposals.toEvaluable(row);
    if (
      !row.categoria.habilitada ||
      !CODIGOS_CATEGORIA.includes(evaluable.categoria_codigo)
    )
      throw new UnprocessableEntityException({
        codigo: 'CATEGORIA_NO_DISPONIBLE',
        mensaje: 'La categoría ya no está habilitada.',
      });
    this.access.assertCanPropose(
      await this.proposals.getAccountSession(row.id_proponente, tx),
    );
    this.proposals.validateObjectiveFields(evaluable);
    const {
      id_propuesta: _id,
      version_actual: _version,
      ...snapshot
    } = evaluable;
    const activity = await tx.actividad.create({
      data: {
        id_propuesta: row.id_propuesta,
        id_organizador_actual: row.id_proponente,
        version_publicada: row.version_actual,
        contenido_aprobado_json: snapshot,
        estado: 'publicada',
      },
    });
    await this.audit.record(
      {
        id_actor: actorId,
        entidad_afectada: 'actividad',
        identificador_afectado: activity.id_actividad,
        accion: 'actividad_publicada',
        estado_nuevo: 'publicada',
        motivo,
        evento_clave: `actividad:${activity.id_actividad}:publicada`,
      },
      tx,
    );
    await this.notifications.enqueue(
      {
        evento_clave: `propuesta:${row.id_propuesta}:v${row.version_actual}:aprobada:${row.id_proponente}`,
        tipo_evento: 'propuesta_aprobada',
        id_destinatario: row.id_proponente,
        id_propuesta: row.id_propuesta,
        id_actividad: activity.id_actividad,
        titulo: 'Tu propuesta fue aprobada',
        mensaje: 'La actividad ya está publicada en el catálogo.',
        ocurrido_en: new Date().toISOString(),
      },
      tx,
    );
    return activity;
  }
}
