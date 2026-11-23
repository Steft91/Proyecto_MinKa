import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(sesion: SesionActual | undefined) {
    const userId = this.requireUser(sesion);
    const rows = await this.prisma.client.eventoNotificacion.findMany({
      where: { id_destinatario: userId },
      orderBy: { creada_en: 'desc' },
    });
    return rows.map((row) => ({
      ...(row.payload_json as Record<string, unknown>),
      id: row.id_evento,
      eventKey: row.evento_clave,
      leida: row.leida_en !== null,
      creadaEn: row.creada_en.toISOString(),
    }));
  }

  async markRead(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<{ id: string; leida: true }> {
    const userId = this.requireUser(sesion);
    const where = { id_evento: id, id_destinatario: userId };
    const result = await this.prisma.client.eventoNotificacion.updateMany({
      where: { ...where, leida_en: null },
      data: { leida_en: new Date() },
    });
    if (!result.count && !(await this.prisma.client.eventoNotificacion.count({ where }))) {
      throw new NotFoundException({
        codigo: 'NOTIFICACION_NO_ENCONTRADA',
        mensaje: 'La notificación no existe o no pertenece a tu cuenta.',
      });
    }
    return { id, leida: true };
  }

  private requireUser(sesion: SesionActual | undefined): string {
    if (!sesion) {
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Necesitas iniciar sesión para consultar notificaciones.',
      });
    }
    return sesion.id_usuario;
  }
}
