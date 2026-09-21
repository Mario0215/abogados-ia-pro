import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';
import { signClienteToken, setClienteCookie } from '../../../../lib/cliente-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const emailNorm = String(email).trim().toLowerCase();
  const portalUser = await (prisma as any).clientPortalUser.findUnique({ where: { email: emailNorm } });

  if (!portalUser || !portalUser.active) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const valid = await bcrypt.compare(String(password), portalUser.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = signClienteToken({
    uid: portalUser.id,
    email: portalUser.email,
    name: portalUser.name,
    clientId: portalUser.clientId,
  });

  res.setHeader('Set-Cookie', setClienteCookie(token));
  return res.status(200).json({ ok: true });
}
