import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { PrismaModule } from '../../database/prisma.module.js';
import { AccessControlModule } from '../access-control/access-control.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule, AccessControlModule, IdentityModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
