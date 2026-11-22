import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { CompleteProfileDto } from './complete-profile.dto.js';
import { GoogleSessionGuard } from './google-session.guard.js';
import { IdentityService } from './identity.service.js';

@Controller('profile')
export class ProfileController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @UseGuards(GoogleSessionGuard)
  me(@Req() request: SessionRequest) {
    return request.sesion;
  }

  @Patch('me')
  @UseGuards(GoogleSessionGuard)
  complete(
    @Req() request: SessionRequest,
    @Body() body: CompleteProfileDto,
  ) {
    return this.identity.completeProfile(request.sesion!.id_usuario, body);
  }
}
