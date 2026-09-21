import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Datos incompletos' });
  const emailNorm = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user || !user.active) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  const role: 'ABOGADO' | 'ADMIN' = user.role === 'ADMIN' ? 'ADMIN' : 'ABOGADO';
  const token = signToken({ uid: user.id, role, name: user.name, email: user.email });
  res.setHeader('Set-Cookie', setAuthCookie(token));
  return res.status(200).json({ role });
}
