import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { AccessControlModule } from '../access-control/access-control.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule, AccessControlModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
