import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionRequest } from '../access-control/session-request.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { IdentityService } from './identity.service.js';

@Injectable()
export class GoogleSessionGuard implements CanActivate {
  constructor(
    private readonly verifier: GoogleTokenVerifier,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Inicia sesión para realizar esta operación.',
      });
    }
    const claims = await this.verifier.verify(token);
    request.sesion = await this.identity.getSessionByGoogleSubject(claims.sub);
    return true;
  }
}
