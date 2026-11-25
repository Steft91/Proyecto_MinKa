import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AdminGuard } from '../access-control/access-control.guards.js';
import { GoogleSessionGuard } from '../identity/google-session.guard.js';
import type { SessionRequest } from '../access-control/session-request.js';
import { AuditService } from './audit.service.js';

class AuditQuery {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  entity!: string;
  @IsUUID()
  id!: string;
}

@Controller('admin/audit')
@UseGuards(GoogleSessionGuard, AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get()
  list(@Req() req: SessionRequest, @Query() query: AuditQuery) {
    return this.audit.findByEntity(req.sesion, query.entity, query.id);
  }
}
