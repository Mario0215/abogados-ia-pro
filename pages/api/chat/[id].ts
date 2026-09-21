import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'ID requerido' });
  if (req.method === 'GET') {
    const log = await prisma.chatLog.findFirst({
      where: { id, userId: auth.uid }
    });
    if (!log) return res.status(404).json({ error: 'No encontrado' });
    return res.status(200).json({
      id: log.id,
      question: log.question,
      answer: log.answer || '',
      matter: log.matter,
      jurisdiccion: log.jurisdiccion,
      summary: log.summary || '',
      pinned: log.pinned
    });
  }
  if (req.method === 'PUT') {
    const pinned = !!(req.body?.pinned);
    const updated = await prisma.chatLog.updateMany({
      where: { id, userId: auth.uid },
      data: { pinned }
    });
    if (updated.count === 0) return res.status(404).json({ error: 'No encontrado' });
    return res.status(200).json({ id, pinned });
  }
  if (req.method === 'DELETE') {
    const deleted = await prisma.chatLog.deleteMany({
      where: { id, userId: auth.uid }
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'No encontrado' });
    return res.status(204).end();
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
