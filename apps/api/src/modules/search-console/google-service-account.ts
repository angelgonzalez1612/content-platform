import { createSign } from 'node:crypto';

// Autenticación con una cuenta de servicio de Google (JWT firmado con su
// llave privada → access token), sin depender de googleapis. La llave se
// guarda en GOOGLE_SERVICE_ACCOUNT_JSON, como JSON tal cual o en base64.

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().startsWith('{') ? raw.trim() : Buffer.from(raw.trim(), 'base64').toString('utf8');
  const parsed = JSON.parse(text) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no trae client_email y private_key.');
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

export class GoogleTokenProvider {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly scopes: string[],
  ) {}

  get email(): string {
    return this.account.client_email;
  }

  async getToken(): Promise<string> {
    // Margen de un minuto para no usar un token a punto de vencer.
    if (this.cached && this.cached.expiresAt - 60_000 > Date.now()) return this.cached.token;

    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: this.account.client_email,
        scope: this.scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(this.account.private_key);
    const assertion = `${header}.${claims}.${base64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !body.access_token) {
      throw new Error(`Google rechazó la cuenta de servicio: ${body.error_description ?? res.status}`);
    }
    this.cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }
}
