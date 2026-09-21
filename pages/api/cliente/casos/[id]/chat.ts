import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { getClienteFromCookies } from '../../../../../lib/cliente-auth';
import { sendCaseChatEmail } from '../../../../../lib/email';
import { PORTAL_CONFIG } from '../../../../../lib/cliente-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caseId = String(req.query.id || '');
  const { message } = req.body || {};
  const msg = String(message || '').trim();
  if (!caseId || !msg) return res.status(400).json({ error: 'Datos incompletos' });

  const portalUser: any = await (prisma as any).clientPortalUser.findUnique({
    where: { id: auth.uid },
    include: { client: true },
  });
  if (!portalUser?.clientId) return res.status(403).json({ error: 'Cliente no vinculado' });

  const caso: any = await (prisma as any).legalCase.findFirst({
    where: { id: caseId, clientId: portalUser.clientId, isActive: true },
    select: { id: true, expediente: true, abogadoId: true },
  });
  if (!caso) return res.status(404).json({ error: 'Expediente no encontrado' });

  let abogadoEmail = '';
  let abogadoName = 'Abogado';
  if (caso.abogadoId) {
    const abogado = await prisma.user.findUnique({ where: { id: caso.abogadoId }, select: { email: true, name: true } });
    abogadoEmail = abogado?.email || '';
    abogadoName = abogado?.name || 'Abogado';
  }

  const toEmail = abogadoEmail || PORTAL_CONFIG.contacto.email;
  const toName = abogadoEmail ? abogadoName : 'Administración';

  const event = await prisma.caseEvent.create({
    data: {
      caseId: caso.id,
      type: 'CHAT',
      from: auth.email,
      to: toEmail,
      message: msg,
    },
  });

  await sendCaseChatEmail({
    toEmail,
    toName,
    ccEmail: PORTAL_CONFIG.contacto.email,
    expediente: caso.expediente || '—',
    fromLabel: auth.name || auth.email || 'Cliente',
    message: msg,
  });

  return res.status(201).json({ event });
}

