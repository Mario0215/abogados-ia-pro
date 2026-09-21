import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { sendCaseChatEmail } from '../../../lib/email';
import { PORTAL_CONFIG } from '../../../lib/cliente-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId, message } = req.body || {};
  const id = String(caseId || '');
  const msg = String(message || '').trim();
  if (!id || !msg) return res.status(400).json({ error: 'Datos incompletos' });

  const lc = await prisma.legalCase.findUnique({
    where: { id },
    select: {
      id: true,
      expediente: true,
      userId: true,
      abogadoId: true,
      client: { select: { name: true, email: true, portalUser: { select: { email: true, name: true } } } },
    },
  });
  if (!canAccessLegalCase(auth, lc as any, true)) return res.status(404).json({ error: 'Caso no encontrado' });

  const toEmail = lc?.client?.email || lc?.client?.portalUser?.email || '';
  const toName = lc?.client?.name || lc?.client?.portalUser?.name || 'Cliente';
  if (!toEmail) return res.status(400).json({ error: 'El cliente no tiene correo registrado' });

  const event = await prisma.caseEvent.create({
    data: {
      caseId: id,
      type: 'CHAT',
      from: auth.email || auth.name || 'Abogado',
      to: toEmail,
      message: msg,
    },
  });

  await sendCaseChatEmail({
    toEmail,
    toName,
    ccEmail: PORTAL_CONFIG.contacto.email,
    expediente: lc?.expediente || '—',
    fromLabel: auth.name || auth.email || 'Abogado',
    message: msg,
  });

  return res.status(201).json({ event });
}
