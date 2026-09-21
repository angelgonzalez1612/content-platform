import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import type { AuthUser, UserRole } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { users } from '../../db/schema';
import type { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

const SALT_ROUNDS = 10;

function toAuthUser(row: { id: string; email: string; name: string; role: UserRole; createdAt: Date }): AuthUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async list(): Promise<AuthUser[]> {
    const rows = await this.db.query.users.findMany({ orderBy: (u, { asc }) => asc(u.createdAt) });
    return rows.map(toAuthUser);
  }

  async create(dto: CreateUserDto): Promise<AuthUser> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo.');

    const passwordHash = await hash(dto.password, SALT_ROUNDS);
    const [row] = await this.db
      .insert(users)
      .values({ email, name: dto.name, passwordHash, role: dto.role })
      .returning();

    return toAuthUser(row);
  }

  async update(id: string, dto: UpdateUserDto): Promise<AuthUser> {
    if (dto.role) await this.assertNotDemotingLastAdmin(id, dto.role);

    const [row] = await this.db.update(users).set(dto).where(eq(users.id, id)).returning();
    if (!row) throw new NotFoundException('Usuario no encontrado.');
    return toAuthUser(row);
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<void> {
    const passwordHash = await hash(dto.password, SALT_ROUNDS);
    const [row] = await this.db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning({ id: users.id });
    if (!row) throw new NotFoundException('Usuario no encontrado.');
  }

  async remove(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) throw new ForbiddenException('No puedes eliminar tu propia cuenta.');

    const target = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.role === 'admin') await this.assertNotLastAdmin();

    await this.db.delete(users).where(eq(users.id, id));
  }

  private async assertNotDemotingLastAdmin(id: string, nextRole: UserRole): Promise<void> {
    if (nextRole === 'admin') return;
    const target = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (target?.role === 'admin') await this.assertNotLastAdmin();
  }

  private async assertNotLastAdmin(): Promise<void> {
    const [row] = await this.db.select({ total: count() }).from(users).where(eq(users.role, 'admin'));
    if ((row?.total ?? 0) <= 1) {
      throw new ForbiddenException('Debe quedar al menos un administrador.');
    }
  }
}
