import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './database/prisma.module.js';
import { AccessControlModule } from './modules/access-control/access-control.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ProposalsModule } from './modules/proposals/proposals.module.js';
import { AdminReviewModule } from './modules/admin-review/admin-review.module.js';

@Module({
  imports: [PrismaModule, AccessControlModule, CatalogModule, ProposalsModule, AdminReviewModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
