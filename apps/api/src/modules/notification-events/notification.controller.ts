import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { GoogleSessionGuard } from '../identity/google-session.guard.js';
import { MarkNotificationDto } from './notification.dto.js';
import { NotificationService } from './notification.service.js';

@Controller('notifications')
@UseGuards(GoogleSessionGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  mine(@Req() request: SessionRequest) {
    return this.notifications.getMine(request.sesion);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: MarkNotificationDto,
  ) {
    return this.notifications.markRead(request.sesion, id);
  }
}
