/** Minimal HS256 JWT (no dependencies) for session tokens. */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '../../model/user';

export interface TokenPayload {
  /** user id */
  sub: string;
  email: string;
  role: Role;
  /** forcePasswordUpdate */
  fpu: boolean;
  iat: number;
  exp: number;
}

const b64urlJson = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

export function signToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSec: number
): string {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson({ ...payload, iat, exp: iat + expiresInSec });
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000))
    return null;
  return payload;
}
