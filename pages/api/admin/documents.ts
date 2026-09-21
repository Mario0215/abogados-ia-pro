import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { bucket } from '../../../lib/gcs';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { state: true }
    });
    return res.status(200).json({ documents: docs });
  }

  if (req.method === 'PUT') {
    const { id, active } = req.body || {};
    if (!id || typeof active !== 'boolean') return res.status(400).json({ error: 'Datos inválidos' });
    await prisma.document.update({ where: { id }, data: { active } });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const form = formidable({ multiples: false, keepExtensions: true });
    form.parse(req, async (err: any, fields: any, files: any) => {
      if (err) return res.status(400).json({ error: 'Error de carga' });
      const title = String(fields.title || '');
      const matter = String(fields.matter || '');
      const jurisdiccion = String(fields.jurisdiccion || '');
      const stateId = fields.stateId ? String(fields.stateId) : null;
      const active = fields.active ? String(fields.active) === 'true' : true;
      if (!title || !matter || !jurisdiccion) return res.status(400).json({ error: 'Datos requeridos' });
      const f = files.file as formidable.File;
      if (!f || !bucket) return res.status(500).json({ error: 'GCS no configurado' });
      const objectName = `docs/${Date.now()}_${String(f.originalFilename || 'documento')}`;
      const ws = bucket.file(objectName).createWriteStream({ contentType: String(f.mimetype || 'application/octet-stream') });
      ws.on('error', () => res.status(500).json({ error: 'Error subiendo a GCS' }));
      ws.on('finish', async () => {
        const doc = await prisma.document.create({
          data: { title, matter, jurisdiccion, stateId, active, storagePath: `gs://${bucket.name}/${objectName}` }
        });
        return res.status(201).json({ id: doc.id });
      });
      const rs: any = f.filepath ? (await import('fs')).createReadStream(String(f.filepath)) : null;
      if (!rs) return res.status(400).json({ error: 'Archivo requerido' });
      rs.pipe(ws);
    });
    return;
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
