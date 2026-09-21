import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { bucket, signedWrite } from '../../lib/gcs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!bucket) return res.status(500).json({ error: 'GCS no configurado' });
  const { consultationId, filename, contentType } = req.body || {};
  if (!consultationId || !filename || !contentType) return res.status(400).json({ error: 'Datos requeridos' });
  const c = await prisma.consultation.findUnique({ where: { id: String(consultationId) } });
  if (!c || c.userId !== auth.uid) return res.status(404).json({ error: 'Consulta no encontrada' });
  const objectName = `consultations/${String(consultationId)}/${Date.now()}_${String(filename)}`;
  const url = await signedWrite(objectName, String(contentType), 15);
  if (!url) return res.status(500).json({ error: 'No se pudo generar URL' });
  const att = await prisma.attachment.create({
    data: {
      consultationId: String(consultationId),
      originalName: String(filename),
      mimeType: String(contentType),
      storagePath: `gs://${bucket.name}/${objectName}`
    }
  });
  return res.status(200).json({ url, objectName, id: att.id });
}
