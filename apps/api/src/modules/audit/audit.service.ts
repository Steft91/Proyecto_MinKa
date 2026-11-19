import { Injectable } from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AccessControlService } from '../access-control/access-control.service.js';

export interface AuditEvent {
  id_actor?: string;
  entidad_afectada: string;
  identificador_afectado: string;
  accion: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  motivo?: string;
  evento_clave: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  record(event: AuditEvent, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.registroAuditoria.upsert({
      where: { evento_clave: event.evento_clave },
      update: {},
      create: event,
    });
  }

  findByEntity(sesion: SesionActual | undefined, entidad: string, id: string) {
    this.access.assertAdmin(sesion);
    return this.prisma.client.registroAuditoria.findMany({
      where: { entidad_afectada: entidad, identificador_afectado: id },
      orderBy: [{ ocurrido_en: 'asc' }, { id_auditoria: 'asc' }],
    });
  }
}
