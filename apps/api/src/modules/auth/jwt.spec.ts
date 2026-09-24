import { signSession, verifySession } from './jwt';

describe('session JWT', () => {
  it('preserves the session version used for revocation', () => {
    const secret = 'a-test-secret-with-at-least-32-characters';
    const payload = {
      sub: 'user-1',
      email: 'editor@example.com',
      role: 'editor' as const,
      sessionVersion: 4,
    };
    const decoded = verifySession(signSession(payload, secret), secret);
    expect(decoded).toMatchObject(payload);
  });
});
