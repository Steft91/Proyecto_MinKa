import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { NotificationEventsService } from './notification-events.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { IdentityModule } from '../identity/identity.module.js';
import { GmailApiEmailSender } from './email-sender.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationController],
  providers: [
    NotificationEventsService,
    NotificationService,
    GmailApiEmailSender,
  ],
  exports: [NotificationEventsService, NotificationService],
})
export class NotificationEventsModule {}
