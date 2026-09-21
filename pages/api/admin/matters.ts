import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const matters = await prisma.matterConfig.findMany({ orderBy: { label: 'asc' } });
    return res.status(200).json({ matters });
  }

  if (req.method === 'PUT') {
    const { key, active } = req.body || {};
    if (!key || typeof active !== 'boolean') return res.status(400).json({ error: 'Datos inválidos' });
    await prisma.matterConfig.update({ where: { key }, data: { active } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
