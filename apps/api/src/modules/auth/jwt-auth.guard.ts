import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { users } from '../../db/schema';
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from './jwt';

export interface RequestWithSession extends Request {
  session?: SessionPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('No has iniciado sesión');
    }

    try {
      const session = verifySession(token, this.config.getOrThrow<string>('JWT_SECRET'));
      const user = await this.db.query.users.findFirst({
        where: eq(users.id, session.sub),
        columns: { email: true, role: true, sessionVersion: true },
      });
      if (
        !user ||
        user.email !== session.email ||
        user.role !== session.role ||
        user.sessionVersion !== session.sessionVersion
      ) {
        throw new UnauthorizedException('Sesión revocada');
      }
      req.session = session;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }
}
