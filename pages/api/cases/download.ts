import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { bucket, signedRead } from '../../../lib/gcs';
import { getDownloadUrl } from '../../../lib/storage';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = typeof req.query.id === 'string' ? req.query.id : null;
  const caseWhere: any = auth.role === 'ADMIN' ? {} : { abogadoId: auth.uid };
  const attachment = await prisma.caseAttachment.findFirst({
    where: id
      ? { id, case: caseWhere }
      : { case: caseWhere },
    orderBy: id ? undefined : { createdAt: 'desc' }
  });

  if (!attachment) return res.status(404).json({ error: 'No se encontró el adjunto' });

  const sp = attachment.storagePath || '';
  try {
    if (sp) {
      const direct = await getDownloadUrl(sp);
      return res.redirect(direct);
    }
  } catch {}
  if (sp.startsWith('gs://') && bucket) {
    const objectName = sp.replace(`gs://${bucket.name}/`, '');
    const url = await signedRead(objectName, 15);
    if (!url) return res.status(500).json({ error: 'URL no disponible' });
    return res.redirect(url);
  }
  if (!sp || !fs.existsSync(sp)) return res.status(404).json({ error: 'Archivo no disponible' });
  const fileName = attachment.originalName || 'documento';
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  const stream = fs.createReadStream(sp);
  stream.on('error', () => res.status(500).end());
  stream.pipe(res);
}
