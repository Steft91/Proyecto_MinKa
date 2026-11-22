import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { ProposerGuard } from '../access-control/access-control.guards.js';
import { CreateProposalDto } from './create-proposal.dto.js';
import { ProposalsService } from './proposals.service.js';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get('eligibility')
  eligibility(@Req() req: SessionRequest) {
    return this.proposals.eligibility(req.sesion);
  }

  @Get('me')
  mine(@Req() req: SessionRequest) {
    return this.proposals.getMine(req.sesion);
  }

  @Get(':id')
  detail(
    @Req() req: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.proposals.getByIdAuthorized(req.sesion, id);
  }

  @Post()
  @UseGuards(ProposerGuard)
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateProposalDto,
    @Headers('idempotency-key') clave?: string,
  ) {
    return this.proposals.create(req.sesion, body, clave);
  }
}
