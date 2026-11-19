import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Headers,
  Injectable,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { EvaluationResultDto } from './evaluation-result.dto.js';
import { EvaluationResultsService } from './evaluation-results.service.js';

@Injectable()
export class EvaluationCallbackGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.MINKA_EVALUATION_CALLBACK_TOKEN;
    if (!token)
      throw new ServiceUnavailableException({
        codigo: 'INTEGRACION_NO_CONFIGURADA',
        mensaje: 'La recepción de evaluaciones aún no está configurada.',
      });
    const header =
      context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    const actual = Buffer.from(header);
    const expected = Buffer.from(`Bearer ${token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Credencial de servicio inválida.',
      });
    return true;
  }
}

@Controller('internal/evaluations/result')
@UseGuards(EvaluationCallbackGuard)
export class EvaluationResultsController {
  constructor(private readonly results: EvaluationResultsService) {}
  @Post()
  apply(
    @Body() body: EvaluationResultDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.results.apply(body, key);
  }
}
