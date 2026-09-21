import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAuthFromCookies } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { saveBuffer } from '../../lib/storage';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const storageProvider = String(process.env.STORAGE_PROVIDER || '').toLowerCase();
  const uploadDir = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({ multiples: false, uploadDir, keepExtensions: true });
  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) return res.status(400).json({ error: 'Error de carga' });
    const consultationId = String(fields.consultationId || '');
    if (!consultationId) return res.status(400).json({ error: 'Consulta requerida' });
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId, userId: auth.uid },
      select: { id: true }
    });
    if (!consultation) return res.status(404).json({ error: 'Consulta no encontrada' });
    const file = files.file as formidable.File;
    if (!file) return res.status(400).json({ error: 'Archivo requerido' });

    const originalName = file.originalFilename || 'archivo';
    const mimeType = file.mimetype || 'application/octet-stream';
    let storagePath = file.filepath;
    if (storageProvider === 'vercel-blob' || storageProvider === 'gcs') {
      const safeName = String(originalName).replace(/[\\/]/g, '_');
      const objectName = `consultations/${consultationId}/${Date.now()}_${safeName}`;
      const buf = fs.readFileSync(String(file.filepath));
      const saved = await saveBuffer(objectName, buf, String(mimeType));
      storagePath = saved.url;
    }
    await prisma.attachment.create({
      data: {
        consultationId,
        originalName,
        mimeType,
        storagePath
      }
    });
    return res.status(201).json({ ok: true });
  });
}
