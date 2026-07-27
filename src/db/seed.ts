import 'dotenv/config';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const SALT_ROUNDS = 12;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no están definidos — nada que sembrar.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase().trim()),
  });

  if (existing) {
    console.log(`Ya existe un usuario con el correo ${email} — nada que hacer.`);
    await pool.end();
    return;
  }

  const passwordHash = await hash(password, SALT_ROUNDS);
  await db.insert(schema.users).values({
    email: email.toLowerCase().trim(),
    passwordHash,
    name,
    role: 'admin',
  });

  console.log(`Usuario admin creado: ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
