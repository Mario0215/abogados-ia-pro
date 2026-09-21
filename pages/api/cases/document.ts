import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { saveBuffer } from '../../../lib/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const { caseId, text, concept } = req.body || {};
  if (!caseId || typeof text !== 'string') return res.status(400).json({ error: 'Datos requeridos' });
  const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, userId: true, abogadoId: true } });
  if (!canAccessLegalCase(auth, lc, true)) return res.status(404).json({ error: 'Caso no encontrado' });
  try {
    const normalizedConcept = typeof concept === 'string' && concept.trim() ? concept.trim() : null;
    if (normalizedConcept) {
      const prev = await prisma.caseAttachment.findUnique({
        where: { caseId_concept: { caseId: String(caseId), concept: normalizedConcept } },
      });
      if (prev) {
        await prisma.caseAttachment.delete({ where: { id: prev.id } });
      }
    } else {
      await prisma.caseAttachment.deleteMany({ where: { caseId: String(caseId), mimeType: 'text/plain' } });
    }
    const objectName = `cases/${String(caseId)}/demanda_${Date.now()}.txt`;
    const saved = await saveBuffer(objectName, Buffer.from(String(text), 'utf8'), 'text/plain; charset=utf-8');
    const att = await prisma.caseAttachment.create({
      data: {
        caseId: String(caseId),
        originalName: 'demanda.txt',
        mimeType: 'text/plain',
        storagePath: saved.url,
        concept: normalizedConcept,
      }
    });
    await prisma.caseEvent.create({ data: { caseId: String(caseId), type: 'ATTACHMENT', message: 'demanda.txt (borrador)' } });
    return res.status(200).json({ id: att.id });
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo guardar el borrador';
    return res.status(500).json({ error: msg });
  }
}
