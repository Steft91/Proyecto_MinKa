import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../access-control/access-control.guards.js';
import type { SessionRequest } from '../access-control/session-request.js';
import { AdminReviewService } from './admin-review.service.js';
import { AdminDecisionDto } from './admin-review.dto.js';

@Controller('admin/proposals')
@UseGuards(AdminGuard)
export class AdminReviewController {
  constructor(private readonly review: AdminReviewService) {}
  @Get('review')
  pending(@Req() req: SessionRequest) {
    return this.review.listPending(req.sesion);
  }
  @Get(':id')
  detail(
    @Req() req: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.review.getDetail(req.sesion, id);
  }
  @Post(':id/decision')
  decide(
    @Req() req: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AdminDecisionDto,
  ) {
    return this.review.decide(req.sesion, id, input);
  }
}
