import * as jwt from 'jsonwebtoken';

export interface SessionPayload {
  sub: string;
  email: string;
  role: 'admin' | 'editor';
}

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const SESSION_COOKIE_NAME = 'planazo_session';
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_COOKIE_MAX_AGE_SECONDS * 1000;

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: SESSION_COOKIE_MAX_AGE_SECONDS });
}

export function verifySession(token: string, secret: string): SessionPayload {
  return jwt.verify(token, secret) as SessionPayload;
}
