import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../../../../../lib/prisma';
import { getClienteFromCookies } from '../../../../../lib/cliente-auth';
import { saveBuffer } from '../../../../../lib/storage';
import { sendCaseChatEmail } from '../../../../../lib/email';
import { PORTAL_CONFIG } from '../../../../../lib/cliente-config';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caseId = String(req.query.id || '');
  if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

  const uploadDir = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({ multiples: false, uploadDir, keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Error de carga' });

    const key = String(fields.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key requerido' });
    const fileRaw: any = (files as any).file;
    const file: formidable.File | undefined = Array.isArray(fileRaw) ? fileRaw[0] : fileRaw;
    if (!file) return res.status(400).json({ error: 'Archivo requerido' });

    const portalUser: any = await (prisma as any).clientPortalUser.findUnique({ where: { id: auth.uid }, select: { clientId: true, name: true, email: true } });
    if (!portalUser?.clientId) return res.status(403).json({ error: 'Cliente no vinculado' });

    const caso: any = await (prisma as any).legalCase.findFirst({
      where: { id: caseId, clientId: portalUser.clientId, isActive: true },
      select: { id: true, expediente: true, abogadoId: true, notes: true },
    });
    if (!caso) return res.status(404).json({ error: 'Expediente no encontrado' });

    const originalName = file.originalFilename || 'documento';
    const mimeType = file.mimetype || 'application/octet-stream';
    const objectName = `cases/${caso.id}/DOC_${Date.now()}_${String(originalName).replace(/[\\/]/g, '_')}`;
    const buf = fs.readFileSync(String(file.filepath));
    const saved = await saveBuffer(objectName, buf, String(mimeType));

    const concept = `DOC:${key}`;
    const att = await prisma.caseAttachment.create({
      data: {
        caseId: caso.id,
        originalName,
        mimeType: String(mimeType),
        storagePath: saved.url,
        concept,
      } as any,
    });

    try {
      const notesObj = (() => { try { return JSON.parse(caso.notes || '{}'); } catch { return {}; } })();
      const reqs = Array.isArray(notesObj.docRequests) ? notesObj.docRequests : [];
      const updatedReqs = reqs.map((r: any) => (r?.key === key ? { ...r, status: 'RECIBIDO', receivedAt: new Date().toISOString(), attachmentId: att.id } : r));
      await prisma.legalCase.update({ where: { id: caso.id }, data: { notes: JSON.stringify({ ...notesObj, docRequests: updatedReqs }) } });
    } catch {}

    await prisma.caseEvent.create({ data: { caseId: caso.id, type: 'ATTACHMENT', message: `Documento recibido: ${originalName}` } });

    let abogadoEmail = '';
    let abogadoName = 'Abogado';
    if (caso.abogadoId) {
      const abogado = await prisma.user.findUnique({ where: { id: caso.abogadoId }, select: { email: true, name: true } });
      abogadoEmail = abogado?.email || '';
      abogadoName = abogado?.name || 'Abogado';
    }
    if (abogadoEmail) {
      await sendCaseChatEmail({
        toEmail: abogadoEmail,
        toName: abogadoName,
        ccEmail: PORTAL_CONFIG.contacto.email,
        expediente: caso.expediente || '—',
        fromLabel: portalUser.name || auth.name || auth.email || 'Cliente',
        message: `Se subió un documento: ${originalName}`,
      });
    } else {
      await sendCaseChatEmail({
        toEmail: PORTAL_CONFIG.contacto.email,
        toName: 'Administración',
        ccEmail: PORTAL_CONFIG.contacto.email,
        expediente: caso.expediente || '—',
        fromLabel: portalUser.name || auth.name || auth.email || 'Cliente',
        message: `Se subió un documento: ${originalName}`,
      });
    }

    return res.status(201).json({ attachmentId: att.id });
  });
}
