import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { authLoginAttempts } from '../../db/schema';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

@Injectable()
export class LoginRateLimiterService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  keyFor(ip: string, email: string): string {
    return createHash('sha256').update(`${ip}|${email.trim().toLowerCase()}`).digest('hex');
  }

  async assertAllowed(key: string): Promise<void> {
    const row = await this.db.query.authLoginAttempts.findFirst({
      where: eq(authLoginAttempts.key, key),
    });
    if (row?.blockedUntil && row.blockedUntil.getTime() > Date.now()) {
      throw new HttpException('Demasiados intentos. Intenta de nuevo en 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(key: string): Promise<void> {
    const now = new Date();
    const existing = await this.db.query.authLoginAttempts.findFirst({
      where: eq(authLoginAttempts.key, key),
    });
    const outsideWindow = !existing || now.getTime() - existing.windowStartedAt.getTime() >= WINDOW_MS;
    const failureCount = outsideWindow ? 1 : existing.failureCount + 1;
    const values = {
      failureCount,
      windowStartedAt: outsideWindow ? now : existing.windowStartedAt,
      blockedUntil: failureCount >= MAX_FAILURES ? new Date(now.getTime() + WINDOW_MS) : null,
      updatedAt: now,
    };
    await this.db
      .insert(authLoginAttempts)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: authLoginAttempts.key, set: values });
  }

  async clear(key: string): Promise<void> {
    await this.db.delete(authLoginAttempts).where(eq(authLoginAttempts.key, key));
  }
}
