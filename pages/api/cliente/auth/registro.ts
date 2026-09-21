import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';
import { signClienteToken, setClienteCookie } from '../../../../lib/cliente-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const emailNorm = String(email).trim().toLowerCase();

  // Verificar si ya existe
  const existing = await (prisma as any).clientPortalUser.findUnique({ where: { email: emailNorm } });
  if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

  const passwordHash = await bcrypt.hash(String(password), 10);

  // El vínculo por correo es opt-in: requiere una configuración explícita del entorno.
  let clientId: string | null = null;
  if (process.env.PORTAL_AUTO_LINK_EXISTING_CLIENTS === 'true') {
    const matchingClient = await prisma.client.findFirst({ where: { email: emailNorm } });
    clientId = matchingClient?.id ?? null;
  }

  const portalUser = await (prisma as any).clientPortalUser.create({
    data: {
      name: String(name).trim(),
      email: emailNorm,
      phone: phone ? String(phone).trim() : null,
      passwordHash,
      clientId,
    },
  });

  const token = signClienteToken({
    uid: portalUser.id,
    email: portalUser.email,
    name: portalUser.name,
    clientId: portalUser.clientId,
  });

  res.setHeader('Set-Cookie', setClienteCookie(token));
  return res.status(201).json({ ok: true });
}
