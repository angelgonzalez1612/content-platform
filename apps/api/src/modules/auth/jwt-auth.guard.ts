import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from './jwt';

export interface RequestWithSession extends Request {
  session?: SessionPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('No has iniciado sesión');
    }

    try {
      req.session = verifySession(token, this.config.getOrThrow<string>('JWT_SECRET'));
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }
}
