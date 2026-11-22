import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import type { GoogleIdentityClaims } from './google-identity.types.js';
import type { CompleteProfileDto } from './complete-profile.dto.js';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async loginWithGoogle(claims: GoogleIdentityClaims): Promise<SesionActual> {
    const user = await this.prisma.client.usuario.upsert({
      where: { google_subject: claims.sub },
      create: {
        google_subject: claims.sub,
        correo: claims.email,
        correo_verificado: claims.email_verified,
        perfil_completo: false,
        persona: {
          create: {
            nombres: claims.given_name ?? claims.name,
            apellidos: claims.family_name,
          },
        },
      },
      update: {
        correo: claims.email,
        correo_verificado: claims.email_verified,
      },
      include: { roles: { include: { rol: true } } },
    });

    if (user.estado !== 'activo') {
      throw new UnauthorizedException('La cuenta no está activa.');
    }

    return this.toSession(user);
  }

  async getSessionByGoogleSubject(subject: string): Promise<SesionActual> {
    const user = await this.prisma.client.usuario.findUnique({
      where: { google_subject: subject },
      include: { roles: { include: { rol: true } } },
    });
    if (!user) {
      throw new NotFoundException('La cuenta de Google aún no está registrada.');
    }
    if (user.estado !== 'activo') {
      throw new UnauthorizedException('La cuenta no está activa.');
    }
    return this.toSession(user);
  }

  async completeProfile(
    userId: string,
    input: CompleteProfileDto,
  ): Promise<SesionActual> {
    const birthDate = new Date(input.fecha_nacimiento);
    const today = new Date();
    const cutoff = new Date(
      Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()),
    );
    if (birthDate > cutoff) {
      throw new UnauthorizedException('La persona debe tener al menos 18 años.');
    }
    const user = await this.prisma.client.usuario.update({
      where: { id_usuario: userId },
      data: {
        perfil_completo: true,
        persona: {
          update: {
            nombres: input.nombres.trim(),
            apellidos: input.apellidos.trim(),
            fecha_nacimiento: birthDate,
            sector_residencia: input.sector_residencia.trim(),
          },
        },
      },
      include: { roles: { include: { rol: true } } },
    });
    return this.toSession(user);
  }

  private toSession(user: {
    id_usuario: string;
    correo: string;
    correo_verificado: boolean;
    perfil_completo: boolean;
    estado: 'activo' | 'suspendido';
    puntos: number;
    estrellas: { toNumber(): number };
    roles: Array<{ rol: { nombre: string } }>;
  }): SesionActual {
    return {
      id_usuario: user.id_usuario,
      correo: user.correo,
      correo_verificado: user.correo_verificado,
      perfil_completo: user.perfil_completo,
      mayor_edad: user.perfil_completo,
      estado: user.estado,
      roles: user.roles.map(({ rol }) => rol.nombre as SesionActual['roles'][number]),
      puntos: user.puntos,
      estrellas: user.estrellas.toNumber(),
    };
  }
}
