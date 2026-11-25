import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleIdentityClaims } from './google-identity.types.js';

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  async verify(idToken: string): Promise<GoogleIdentityClaims> {
    const audience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!audience) {
      throw new Error('GOOGLE_CLIENT_ID no está configurado.');
    }

    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || !payload.email_verified) {
        throw new UnauthorizedException('La identidad de Google no es elegible.');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token de Google inválido o expirado.');
    }
  }
}
