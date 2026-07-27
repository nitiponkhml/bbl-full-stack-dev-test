import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const domain = process.env.AUTH0_DOMAIN;
    const audience = process.env.AUTH0_AUDIENCE;

    if (!domain) {
      throw new Error('AUTH0_DOMAIN environment variable is not set');
    }
    if (!audience) {
      throw new Error('AUTH0_AUDIENCE environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
      issuer: `https://${domain}/`,
      audience,
      algorithms: ['RS256'],
    });
  }

  validate(payload: { sub: string }) {
    return { sub: payload.sub };
  }
}
