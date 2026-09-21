import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { sendCaseChatEmail } from '../../../lib/email';
import { PORTAL_CONFIG } from '../../../lib/cliente-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId, label } = req.body || {};
  const id = String(caseId || '');
  const lbl = String(label || '').trim();
  if (!id || !lbl) return res.status(400).json({ error: 'Datos incompletos' });

  const lc: any = await prisma.legalCase.findUnique({
    where: { id },
    select: {
      id: true,
      expediente: true,
      userId: true,
      abogadoId: true,
      notes: true,
      client: { select: { name: true, email: true, portalUser: { select: { email: true, name: true } } } },
    },
  });
  if (!canAccessLegalCase(auth, lc, true)) return res.status(404).json({ error: 'Caso no encontrado' });

  const toEmail = lc?.client?.email || lc?.client?.portalUser?.email || '';
  const toName = lc?.client?.name || lc?.client?.portalUser?.name || 'Cliente';
  if (!toEmail) return res.status(400).json({ error: 'El cliente no tiene correo registrado' });

  const key = `REQ_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const request = { id: `req_${Date.now()}_${Math.random().toString(16).slice(2)}`, key, label: lbl, status: 'PENDIENTE', createdAt: new Date().toISOString() };
  const notesObj = (() => { try { return JSON.parse(lc.notes || '{}'); } catch { return {}; } })();
  const existing = Array.isArray(notesObj.docRequests) ? notesObj.docRequests : [];
  const updatedNotes = { ...notesObj, docRequests: [...existing, request] };
  await prisma.legalCase.update({ where: { id: lc.id }, data: { notes: JSON.stringify(updatedNotes) } });

  await prisma.caseEvent.create({
    data: { caseId: lc.id, type: 'CHAT', from: auth.email || auth.name || 'Abogado', to: toEmail, message: `Solicitud de documento: ${lbl}` },
  });

  await sendCaseChatEmail({
    toEmail,
    toName,
    ccEmail: PORTAL_CONFIG.contacto.email,
    expediente: lc.expediente || '—',
    fromLabel: auth.name || auth.email || 'Abogado',
    message: `Por favor sube el siguiente documento: ${lbl}`,
  });

  return res.status(201).json({ request });
}

