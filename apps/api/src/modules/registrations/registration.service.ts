import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationEventsService } from '../notification-events/notification-events.service.js';
import type { CancelRegistrationDto } from './cancel-registration.dto.js';

type ActivityContent = { inicio_previsto?: string; cupo_maximo?: number; titulo?: string };

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationEventsService) {}

  async create(sesion: SesionActual | undefined, activityId: string) {
    const userId = this.requireActiveUser(sesion);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_actividad FROM actividad WHERE id_actividad = ${activityId}::uuid FOR UPDATE`;
      const activity = await tx.actividad.findUnique({ where: { id_actividad: activityId } });
      if (!activity || activity.estado !== 'publicada') throw new NotFoundException({ codigo: 'ACTIVIDAD_NO_DISPONIBLE', mensaje: 'La actividad no está publicada o no existe.' });
      const content = activity.contenido_aprobado_json as ActivityContent;
      if (!content.inicio_previsto || new Date(content.inicio_previsto) <= new Date()) throw new UnprocessableEntityException({ codigo: 'ACTIVIDAD_NO_FUTURA', mensaje: 'Solo puedes inscribirte en actividades futuras.' });
      const existing = await tx.inscripcion.findUnique({ where: { id_usuario_id_actividad: { id_usuario: userId, id_actividad: activityId } } });
      if (existing && existing.estado !== 'cancelada_ciudadano') throw new ConflictException({ codigo: 'INSCRIPCION_DUPLICADA', mensaje: 'Ya tienes una inscripción para esta actividad.' });
      const occupied = await tx.inscripcion.count({ where: { id_actividad: activityId, estado: { in: ['activa', 'pendiente_suspension'] } } });
      if (!content.cupo_maximo || occupied >= content.cupo_maximo) throw new ConflictException({ codigo: 'CUPOS_AGOTADOS', mensaje: 'No hay cupos disponibles.' });
      const registration = existing
        ? await tx.inscripcion.update({ where: { id_inscripcion: existing.id_inscripcion }, data: { estado: 'activa', inscrita_en: new Date(), cancelada_en: null, motivo_cancelacion: null, reactivada_en: new Date() } })
        : await tx.inscripcion.create({ data: { id_usuario: userId, id_actividad: activityId } });
      await this.notifications.enqueue({ evento_clave: `inscripcion:${registration.id_inscripcion}:confirmada:${registration.inscrita_en.toISOString()}`, tipo_evento: 'inscripcion_confirmada', id_destinatario: userId, id_actividad: activityId, titulo: 'Inscripción confirmada', mensaje: `Tu inscripción a ${content.titulo ?? 'la actividad'} fue confirmada.`, ocurrido_en: new Date().toISOString() }, tx);
      return registration;
    });
  }

  async cancel(sesion: SesionActual | undefined, registrationId: string, input: CancelRegistrationDto) {
    const userId = this.requireActiveUser(sesion);
    return this.prisma.client.$transaction(async (tx) => {
      const registration = await tx.inscripcion.findUnique({ where: { id_inscripcion: registrationId }, include: { actividad: true } });
      if (!registration) throw new NotFoundException('Inscripción no encontrada.');
      if (registration.id_usuario !== userId) throw new ForbiddenException('No puedes cancelar una inscripción ajena.');
      if (registration.estado !== 'activa' && registration.estado !== 'pendiente_suspension') throw new ConflictException('La inscripción ya no está activa.');
      const content = registration.actividad.contenido_aprobado_json as ActivityContent;
      const startsAt = content.inicio_previsto ? new Date(content.inicio_previsto) : null;
      const late = !startsAt || startsAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
      const updated = await tx.inscripcion.update({ where: { id_inscripcion: registrationId }, data: { estado: 'cancelada_ciudadano', cancelada_en: new Date(), motivo_cancelacion: input.motivo?.trim() ?? null, penalizacion_cancelacion_aplicada: late, evento_cancelacion_actual: `cancelacion:${registrationId}:${Date.now()}` } });
      await this.notifications.enqueue({ evento_clave: `inscripcion:${registrationId}:cancelada:${updated.cancelada_en!.toISOString()}`, tipo_evento: late ? 'cancelacion_tardia' : 'inscripcion_cancelada', id_destinatario: userId, id_actividad: registration.id_actividad, id_inscripcion: registrationId, titulo: 'Inscripción cancelada', mensaje: late ? 'La cancelación fue registrada dentro de las 24 horas previas; la reputación se resolverá en HU11.' : 'La cancelación fue registrada sin penalización.', ocurrido_en: new Date().toISOString() }, tx);
      return { ...updated, penalizacion_pendiente: late };
    });
  }

  getMine(sesion: SesionActual | undefined) {
    const userId = this.requireActiveUser(sesion);
    return this.prisma.client.inscripcion.findMany({ where: { id_usuario: userId }, orderBy: { inscrita_en: 'desc' }, include: { actividad: true } });
  }

  private requireActiveUser(sesion: SesionActual | undefined): string {
    if (!sesion) throw new ForbiddenException('Necesitas iniciar sesión.');
    if (sesion.estado !== 'activo' || !sesion.perfil_completo || !sesion.mayor_edad) throw new ForbiddenException('Tu cuenta no cumple las condiciones para inscribirse.');
    return sesion.id_usuario;
  }
}
