import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { NotificationEventsService } from './notification-events.service.js';

@Module({
  imports: [PrismaModule],
  providers: [NotificationEventsService],
  exports: [NotificationEventsService],
})
export class NotificationEventsModule {}
