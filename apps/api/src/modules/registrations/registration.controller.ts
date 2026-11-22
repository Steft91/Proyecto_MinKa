import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { GoogleSessionGuard } from '../identity/google-session.guard.js';
import { CancelRegistrationDto } from './cancel-registration.dto.js';
import { RegistrationService } from './registration.service.js';

@Controller()
@UseGuards(GoogleSessionGuard)
export class RegistrationController {
  constructor(private readonly registrations: RegistrationService) {}
  @Post('activities/:id/registrations') create(@Req() req: SessionRequest, @Param('id') id: string) { return this.registrations.create(req.sesion, id); }
  @Get('registrations/me') mine(@Req() req: SessionRequest) { return this.registrations.getMine(req.sesion); }
  @Delete('registrations/:id') cancel(@Req() req: SessionRequest, @Param('id') id: string, @Body() body: CancelRegistrationDto) { return this.registrations.cancel(req.sesion, id, body); }
}
