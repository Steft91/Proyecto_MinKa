import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import { AccessControlService } from './access-control.service.js';

@Injectable()
export class ResourceOwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async assertProposalOwner(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<void> {
    this.accessControl.assertActive(sesion);
    const propuesta = await this.prisma.client.propuesta.findUnique({
      where: { id_propuesta: id },
      select: { id_proponente: true },
    });
    if (!propuesta) {
      throw new NotFoundException({
        codigo: 'PROPUESTA_NO_ENCONTRADA',
        mensaje: 'La propuesta no existe.',
      });
    }
    if (propuesta.id_proponente !== sesion.id_usuario) {
      throw new ForbiddenException({
        codigo: 'PROPUESTA_AJENA',
        mensaje: 'Esta operación requiere ser el proponente.',
      });
    }
  }

  async assertActivityOwner(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<void> {
    this.accessControl.assertActive(sesion);
    const actividad = await this.prisma.client.actividad.findUnique({
      where: { id_actividad: id },
      select: { id_organizador_actual: true },
    });
    if (!actividad) {
      throw new NotFoundException({
        codigo: 'ACTIVIDAD_NO_ENCONTRADA',
        mensaje: 'La actividad no existe.',
      });
    }
    if (actividad.id_organizador_actual !== sesion.id_usuario) {
      throw new ForbiddenException({
        codigo: 'ACTIVIDAD_AJENA',
        mensaje: 'Esta operación requiere ser el organizador actual.',
      });
    }
  }
}
