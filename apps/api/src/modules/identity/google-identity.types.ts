export interface GoogleIdentityClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
}
