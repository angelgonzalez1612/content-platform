import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { users } from '../../db/schema';
import { signSession } from './jwt';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; user: AuthUser }> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase().trim()),
    });

    // Same "invalid email or password" message either way — don't reveal which one was wrong.
    if (!row || !(await compare(dto.password, row.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const user: AuthUser = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
    };

    const token = signSession(
      { sub: user.id, email: user.email, role: user.role },
      this.config.getOrThrow<string>('JWT_SECRET'),
    );

    return { token, user };
  }

  async findById(id: string): Promise<AuthUser | undefined> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!row) return undefined;
    return { id: row.id, email: row.email, name: row.name, role: row.role };
  }
}
