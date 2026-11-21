import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SesionActual } from '@minka/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import type { GoogleIdentityClaims } from './google-identity.types.js';

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

    return {
      id_usuario: user.id_usuario,
      correo: user.correo,
      correo_verificado: user.correo_verificado,
      perfil_completo: user.perfil_completo,
      mayor_edad: false,
      estado: user.estado,
      roles: user.roles.map(({ rol }) => rol.nombre as SesionActual['roles'][number]),
      puntos: user.puntos,
      estrellas: Number(user.estrellas),
    };
  }
}
