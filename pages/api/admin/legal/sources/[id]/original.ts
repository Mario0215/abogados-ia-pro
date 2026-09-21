import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../../../../../lib/auth';
import { getDownloadUrl } from '../../../../../../lib/storage';
import { prisma } from '../../../../../../lib/prisma';

function safeDownloadName(value: string | null): string {
  return String(value || 'fuente-oficial.pdf').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (getAuthFromCookies(req.headers.cookie)?.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'Fuente requerida.' });

  const source = await prisma.legalSource.findUnique({
    where: { id },
    select: {
      originalFileName: true,
      originalMimeType: true,
      originalStoragePath: true,
      originalFileData: true
    }
  });
  if (!source || (!source.originalFileData && !source.originalStoragePath)) {
    return res.status(404).json({ error: 'Archivo original no disponible.' });
  }

  if (source.originalFileData) {
    res.setHeader('Content-Type', source.originalMimeType || 'application/pdf');
    res.setHeader('Content-Length', source.originalFileData.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(source.originalFileName)}"`);
    return res.status(200).send(source.originalFileData);
  }

  try {
    const url = await getDownloadUrl(source.originalStoragePath as string);
    return res.redirect(302, url);
  } catch {
    return res.status(503).json({ error: 'No se pudo obtener una URL segura para el archivo original.' });
  }
}
