import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { saveBuffer } from '../../../lib/storage';
import { getCaseFinancialSummary } from '../../../lib/finance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { caseId, text, format } = req.body || {};
  if (!caseId || typeof text !== 'string') return res.status(400).json({ error: 'Datos requeridos' });
  const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, userId: true, abogadoId: true, precioCliente: true } });
  if (!canAccessLegalCase(auth, lc, true)) return res.status(404).json({ error: 'Caso no encontrado' });
  try {
    const financial = await getCaseFinancialSummary(prisma as any, String(caseId));
    const precio = typeof financial?.precioCliente === 'number' ? Number(financial.precioCliente) : 0;
    const required = precio > 0 ? Math.round(precio * 0.5) : 0;
    if (required > 0) {
      const paid = Number(financial?.totalCobrado || 0);
      if (paid < required) {
        return res.status(402).json({ error: 'Pago pendiente', required, paid });
      }
    }
  } catch {
    return res.status(503).json({ error: 'No fue posible validar el estado de pago del expediente.' });
  }
  const fmt = String(format || 'docx').toLowerCase();
  if (fmt !== 'docx') return res.status(400).json({ error: 'Formato no soportado' });
  try {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const lines = String(text || '').split(/\r?\n/).map((s) => new Paragraph({ children: [new TextRun(s)] }));
    const doc = new Document({ sections: [{ properties: {}, children: lines }] });
    const buf = await Packer.toBuffer(doc);
    const objectName = `cases/${String(caseId)}/DEMANDA_${Date.now()}.docx`;
    const saved = await saveBuffer(objectName, buf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const storagePath = saved.url;

    const previous = await prisma.caseAttachment.findUnique({
      where: { caseId_concept: { caseId: String(caseId), concept: 'DEMANDA' } },
    });
    if (previous) await prisma.caseAttachment.delete({ where: { id: previous.id } });

    const att = await prisma.caseAttachment.create({
      data: {
        caseId: String(caseId),
        originalName: 'DEMANDA.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        storagePath,
        concept: 'DEMANDA',
      }
    });
    await prisma.caseEvent.create({ data: { caseId: String(caseId), type: 'ATTACHMENT', message: 'DEMANDA.docx (exportada)' } });
    return res.status(201).json({ id: att.id });
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo exportar' });
  }
}
