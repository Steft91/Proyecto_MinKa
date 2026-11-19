import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { AccessControlModule } from '../access-control/access-control.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ProposalsModule } from '../proposals/proposals.module.js';
import { AdminReviewController } from './admin-review.controller.js';
import { AdminReviewService } from './admin-review.service.js';
import { NotificationEventsModule } from '../notification-events/notification-events.module.js';

@Module({
  imports: [
    PrismaModule,
    AccessControlModule,
    AuditModule,
    ProposalsModule,
    NotificationEventsModule,
  ],
  controllers: [AdminReviewController],
  providers: [AdminReviewService],
  exports: [AdminReviewService],
})
export class AdminReviewModule {}
