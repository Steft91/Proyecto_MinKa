import type { SesionActual } from '@minka/contracts';
import type { Request } from 'express';

/** Identidad adjunta esta sesión después de verificar las credenciales. */
export interface SessionRequest extends Request {
  sesion?: SesionActual;
}
