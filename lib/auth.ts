import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const COOKIE_NAME = 'abogados_token';
const DEVELOPMENT_JWT_SECRET = 'dev-secret-change';

function getJwtSecret(): string | null {
  const configured = process.env.JWT_SECRET || process.env.JWT_SECRETO || process.env.JNT_SECRETO;
  if (configured) return configured;
  return process.env.NODE_ENV === 'development' ? DEVELOPMENT_JWT_SECRET : null;
}

export type AuthPayload = {
  uid: string;
  role: 'ABOGADO' | 'ADMIN';
  name: string;
  email: string;
};

export function signToken(payload: AuthPayload) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    return jwt.verify(token, secret) as AuthPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string) {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearAuthCookie() {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0
  });
}

export function getAuthFromCookies(cookieHeader?: string): AuthPayload | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

export function canAccessLegalCase(
  auth: AuthPayload,
  lc: { userId?: string | null; abogadoId?: string | null } | null | undefined,
  strictAbogado = false
): boolean {
  if (!auth || !lc) return false;
  if (auth.role === 'ADMIN') return true;
  if (strictAbogado) return lc.abogadoId === auth.uid;
  return lc.userId === auth.uid || lc.abogadoId === auth.uid;
}
