import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
  const { name, phone, email, address, specialty, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Datos incompletos' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  const emailNorm = String(email).trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (exists) return res.status(409).json({ error: 'Correo ya registrado' });
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await prisma.user.create({
    data: { name: String(name).trim(), phone, email: emailNorm, address, specialty, passwordHash, role: 'ABOGADO' }
  });
  return res.status(201).json({ id: user.id });
}
