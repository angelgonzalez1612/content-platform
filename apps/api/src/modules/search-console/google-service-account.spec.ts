import { parseServiceAccount } from './google-service-account';

const account = { client_email: 'lector@proyecto.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n' };

describe('parseServiceAccount', () => {
  it('sin variable no hay cuenta (la pantalla explica qué falta)', () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount('  ')).toBeNull();
  });

  it('acepta el JSON tal cual y convierte los \\n escapados de la llave', () => {
    const parsed = parseServiceAccount(JSON.stringify(account));
    expect(parsed?.client_email).toBe(account.client_email);
    expect(parsed?.private_key).toContain('\nabc\n');
  });

  it('acepta el JSON en base64', () => {
    const parsed = parseServiceAccount(Buffer.from(JSON.stringify(account)).toString('base64'));
    expect(parsed?.client_email).toBe(account.client_email);
  });

  it('falla claro si al JSON le faltan campos', () => {
    expect(() => parseServiceAccount(JSON.stringify({ client_email: 'x' }))).toThrow('client_email y private_key');
  });
});
