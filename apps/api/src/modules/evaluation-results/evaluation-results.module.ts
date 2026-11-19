import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { ProposalsModule } from '../proposals/proposals.module.js';
import { AdminReviewModule } from '../admin-review/admin-review.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationEventsModule } from '../notification-events/notification-events.module.js';
import {
  EvaluationResultsController,
  EvaluationCallbackGuard,
} from './evaluation-results.controller.js';
import { EvaluationResultsService } from './evaluation-results.service.js';

@Module({
  imports: [
    PrismaModule,
    ProposalsModule,
    AdminReviewModule,
    AuditModule,
    NotificationEventsModule,
  ],
  controllers: [EvaluationResultsController],
  providers: [EvaluationCallbackGuard, EvaluationResultsService],
  exports: [EvaluationResultsService],
})
export class EvaluationResultsModule {}
