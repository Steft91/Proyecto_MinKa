import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './database/prisma.module.js';
import { AccessControlModule } from './modules/access-control/access-control.module.js';

@Module({
  imports: [PrismaModule, AccessControlModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
