import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { PrismaModule } from '../../database/prisma.module.js';
import { AccessControlModule } from '../access-control/access-control.module.js';
import { ProposalsController } from './proposals.controller.js';
import { ProposalsService } from './proposals.service.js';
import { NeighborhoodService } from './neighborhood.service.js';
import { EvaluationGateway } from './evaluation.gateway.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationEventsModule } from '../notification-events/notification-events.module.js';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    AccessControlModule,
    AuditModule,
    NotificationEventsModule,
  ],
  controllers: [ProposalsController],
  providers: [
    ProposalsService,
    NeighborhoodService,
    EvaluationGateway,
  ],
  exports: [ProposalsService, EvaluationGateway],
})
export class ProposalsModule {}
