import { Body, Controller, Post } from '@nestjs/common';
import { GoogleAuthDto } from './google-auth.dto.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { IdentityService } from './identity.service.js';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly verifier: GoogleTokenVerifier,
    private readonly identity: IdentityService,
  ) {}

  @Post('google')
  async google(@Body() body: GoogleAuthDto) {
    const claims = await this.verifier.verify(body.idToken);
    return this.identity.loginWithGoogle(claims);
  }
}
