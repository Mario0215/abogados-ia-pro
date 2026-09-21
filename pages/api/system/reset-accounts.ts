import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';

function readToken(req: NextApiRequest): string {
  const header = req.headers['x-reset-token'];
  if (typeof header === 'string') return header.trim();
  return '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (process.env.RESET_ACCOUNTS_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const requiredToken = String(process.env.RESET_ACCOUNTS_TOKEN || '').trim();
  if (!requiredToken) return res.status(404).json({ error: 'Not found' });

  const providedToken = readToken(req);
  if (!providedToken || providedToken !== requiredToken) return res.status(403).json({ error: 'No autorizado' });

  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.DEFAULT_ADMIN_PASSWORD || '');
  const adminName = String(process.env.DEFAULT_ADMIN_NAME || 'Administrador').trim();

  const userEmail = String(process.env.DEFAULT_USER_EMAIL || '').trim().toLowerCase();
  const userPassword = String(process.env.DEFAULT_USER_PASSWORD || '');
  const userName = String(process.env.DEFAULT_USER_NAME || 'Usuario').trim();

  if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
    return res.status(500).json({ error: 'Faltan variables de entorno para crear las cuentas default' });
  }

  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(userPassword, 10),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({ data: { active: false } });

    const adminExisting = await tx.user.findFirst({
      where: { email: { equals: adminEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (adminExisting) {
      await tx.user.update({
        where: { id: adminExisting.id },
        data: { name: adminName, email: adminEmail, passwordHash: adminHash, role: 'ADMIN', active: true },
      });
    } else {
      await tx.user.create({
        data: { name: adminName, email: adminEmail, passwordHash: adminHash, role: 'ADMIN', active: true },
      });
    }

    const userExisting = await tx.user.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (userExisting) {
      await tx.user.update({
        where: { id: userExisting.id },
        data: { name: userName, email: userEmail, passwordHash: userHash, role: 'ABOGADO', active: true },
      });
    } else {
      await tx.user.create({
        data: { name: userName, email: userEmail, passwordHash: userHash, role: 'ABOGADO', active: true },
      });
    }
  });

  return res.status(200).json({ ok: true, adminEmail, userEmail });
}
