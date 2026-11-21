import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { IdentityController } from './identity.controller.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [IdentityController],
  providers: [GoogleTokenVerifier, IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
