import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { GoogleAuthDto } from './google-auth.dto.js';
import { GoogleSessionGuard } from './google-session.guard.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { IdentityService } from './identity.service.js';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly verifier: GoogleTokenVerifier,
    private readonly identity: IdentityService,
  ) {}

  @Get('google/config')
  googleConfig() {
    return { clientId: process.env.GOOGLE_CLIENT_ID?.trim() || null };
  }

  @Post('google')
  async google(@Body() body: GoogleAuthDto) {
    const claims = await this.verifier.verify(body.idToken);
    return this.identity.loginWithGoogle(claims);
  }

  @Get('me')
  @UseGuards(GoogleSessionGuard)
  me(@Req() request: SessionRequest) {
    return request.sesion;
  }
}
