import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const errorCodes: Record<number, string> = {
  400: 'DATOS_INVALIDOS',
  401: 'NO_AUTENTICADO',
  403: 'NO_AUTORIZADO',
  404: 'NO_ENCONTRADO',
  409: 'CONFLICTO',
  422: 'REGLA_NEGOCIO',
  500: 'ERROR_INTERNO',
  503: 'SERVICIO_NO_DISPONIBLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Error no controlado al procesar la solicitud',
        exception,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        codigo: 'ERROR_INTERNO',
        mensaje: 'Ocurrió un error interno.',
      });
      return;
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();
    const details =
      typeof payload === 'string' ? { message: payload } : payload;
    const codigo =
      'codigo' in details && typeof details.codigo === 'string'
        ? details.codigo
        : (errorCodes[status] ?? 'ERROR_HTTP');
    const message = 'message' in details ? details.message : exception.message;
    const mensaje =
      'mensaje' in details && typeof details.mensaje === 'string'
        ? details.mensaje
        : Array.isArray(message)
          ? 'Los datos enviados no son válidos.'
          : message;

    response.status(status).json({
      codigo,
      mensaje,
      ...(Array.isArray(message) ? { errores: message } : {}),
    });
  }
}
