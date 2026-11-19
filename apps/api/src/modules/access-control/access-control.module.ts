import { Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service.js';
import { PrismaModule } from '../../database/prisma.module.js';
import { ResourceOwnershipService } from './resource-ownership.service.js';
import {
  ActiveAccountGuard,
  ActivityOwnerGuard,
  AdminGuard,
  ProposalOwnerGuard,
  ProposerGuard,
} from './access-control.guards.js';

@Module({
  imports: [PrismaModule],
  providers: [
    AccessControlService,
    ResourceOwnershipService,
    ActiveAccountGuard,
    ProposerGuard,
    AdminGuard,
    ProposalOwnerGuard,
    ActivityOwnerGuard,
  ],
  exports: [
    AccessControlService,
    ResourceOwnershipService,
    ActiveAccountGuard,
    ProposerGuard,
    AdminGuard,
    ProposalOwnerGuard,
    ActivityOwnerGuard,
  ],
})
export class AccessControlModule {}
