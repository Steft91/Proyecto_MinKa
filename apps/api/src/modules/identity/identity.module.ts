import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { IdentityController } from './identity.controller.js';
import { ProfileController } from './profile.controller.js';
import { GoogleSessionGuard } from './google-session.guard.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [IdentityController, ProfileController],
  providers: [GoogleSessionGuard, GoogleTokenVerifier, IdentityService],
  exports: [IdentityService, GoogleTokenVerifier],
})
export class IdentityModule {}
