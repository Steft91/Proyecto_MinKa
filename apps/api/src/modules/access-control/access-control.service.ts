import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';

export interface PermisosUsuario {
  puede_participar: boolean;
  puede_proponer: boolean;
  puede_administrar: boolean;
}

interface MotivoBloqueo {
  codigo: string;
  mensaje: string;
}

@Injectable()
export class AccessControlService {
  /** La sesión debe proceder de identidad y reflejar el estado actual de la cuenta. */
  getPermissions(sesion?: SesionActual | null): PermisosUsuario {
    if (!sesion || this.getAccessError(sesion)) {
      return {
        puede_participar: false,
        puede_proponer: false,
        puede_administrar: false,
      };
    }

    return {
      puede_participar: true,
      puede_proponer: sesion.estrellas > 2.5,
      puede_administrar: sesion.roles.includes('administrador'),
    };
  }

  canParticipate(sesion?: SesionActual | null): boolean {
    return this.getPermissions(sesion).puede_participar;
  }

  canPropose(sesion?: SesionActual | null): boolean {
    return this.getPermissions(sesion).puede_proponer;
  }

  assertActive(sesion?: SesionActual | null): asserts sesion is SesionActual {
    const error = this.getAccessError(sesion);
    if (!error) {
      return;
    }
    if (!sesion) {
      throw new UnauthorizedException(error);
    }
    throw new ForbiddenException(error);
  }

  assertCanPropose(sesion?: SesionActual | null): asserts sesion is SesionActual {
    this.assertActive(sesion);
    if (!this.canPropose(sesion)) {
      throw new ForbiddenException({
        codigo: 'ESTRELLAS_INSUFICIENTES',
        mensaje: 'Necesitas más de 2,5 estrellas para presentar una propuesta.',
      });
    }
  }

  assertAdmin(sesion?: SesionActual | null): asserts sesion is SesionActual {
    this.assertActive(sesion);
    if (!this.getPermissions(sesion).puede_administrar) {
      throw new ForbiddenException({
        codigo: 'ROL_ADMINISTRADOR_REQUERIDO',
        mensaje: 'Esta operación requiere el rol de administrador.',
      });
    }
  }

  private getAccessError(sesion?: SesionActual | null): MotivoBloqueo | null {
    if (!sesion) {
      return {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Inicia sesión para realizar esta operación.',
      };
    }
    if (!sesion.correo_verificado) {
      return {
        codigo: 'CORREO_NO_VERIFICADO',
        mensaje: 'Tu cuenta de Google debe tener el correo verificado.',
      };
    }
    if (!sesion.perfil_completo) {
      return {
        codigo: 'PERFIL_INCOMPLETO',
        mensaje: 'Completa tu perfil para realizar esta operación.',
      };
    }
    if (!sesion.mayor_edad) {
      return {
        codigo: 'MAYORIA_EDAD_REQUERIDA',
        mensaje: 'Debes tener al menos 18 años para realizar esta operación.',
      };
    }
    if (sesion.estado !== 'activo' || sesion.estrellas === 0) {
      return {
        codigo: 'CUENTA_NO_HABILITADA',
        mensaje: 'Tu cuenta debe estar activa y tener estrellas para operar.',
      };
    }
    if (
      !Number.isFinite(sesion.estrellas) ||
      sesion.estrellas < 0 ||
      sesion.estrellas > 5
    ) {
      return {
        codigo: 'REPUTACION_INVALIDA',
        mensaje: 'Es necesario revisar la reputación de tu cuenta.',
      };
    }
    return null;
  }
}
