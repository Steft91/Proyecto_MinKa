import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationEventsModule } from '../notification-events/notification-events.module.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({ imports: [PrismaModule, IdentityModule, NotificationEventsModule], controllers: [RegistrationController], providers: [RegistrationService] })
export class RegistrationModule {}
