import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { saveBuffer } from '../../../lib/storage';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 15 * 1024 * 1024 });
  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) return res.status(400).json({ error: 'Error de carga' });
    const caseId = String(fields.caseId || '');
    if (!caseId) return res.status(400).json({ error: 'caseId requerido' });
    const lc = await prisma.legalCase.findUnique({ where: { id: caseId }, select: { id: true, userId: true, abogadoId: true } });
    if (!canAccessLegalCase(auth, lc, true)) return res.status(404).json({ error: 'Caso no encontrado' });
    const concept = fields.concept ? String(fields.concept).trim() : '';
    const f = files.file;
    if (!f || !f.filepath) return res.status(400).json({ error: 'Archivo requerido' });
    const originalName = String(f.originalFilename || 'documento');
    const safeName = originalName.replace(/[\\/]/g, '_');
    const mimeType = String(f.mimetype || 'application/octet-stream');
    try {
      const objectName = `cases/${caseId}/${Date.now()}_${safeName}`;
      const buf = fs.readFileSync(String(f.filepath));
      const saved = await saveBuffer(objectName, buf, mimeType);
        if (concept) {
          const previous = await prisma.caseAttachment.findUnique({
            where: { caseId_concept: { caseId, concept } },
          });
          if (previous) {
            await prisma.caseAttachment.delete({ where: { id: previous.id } });
          }
        }
        const att = await prisma.caseAttachment.create({
          data: {
            caseId,
            originalName,
            mimeType,
            storagePath: saved.url,
            concept: concept || null,
          }
        });
        await prisma.caseEvent.create({ data: { caseId, type: 'ATTACHMENT', message: originalName } });
        return res.status(201).json({ id: att.id });
    } catch {
      return res.status(500).json({ error: 'Error subiendo archivo' });
    }
  });
}
