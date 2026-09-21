import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const COOKIE_NAME = 'cliente_portal_token';
const DEVELOPMENT_JWT_SECRET = 'dev-secret-change';

function getJwtSecret(): string | null {
  const configured = process.env.JWT_SECRET || process.env.JWT_SECRETO || process.env.JNT_SECRETO;
  if (configured) return configured;
  return process.env.NODE_ENV === 'development' ? DEVELOPMENT_JWT_SECRET : null;
}

export type ClienteAuthPayload = {
  uid: string;   // ClientPortalUser.id
  email: string;
  name: string;
  clientId: string | null; // Client.id vinculado (puede ser null)
};

export function signClienteToken(payload: ClienteAuthPayload) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyClienteToken(token: string): ClienteAuthPayload | null {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    return jwt.verify(token, secret) as ClienteAuthPayload;
  } catch {
    return null;
  }
}

export function setClienteCookie(token: string) {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearClienteCookie() {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}

export function getClienteFromCookies(cookieHeader?: string): ClienteAuthPayload | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyClienteToken(token);
}
