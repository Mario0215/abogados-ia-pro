import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const states = await prisma.state.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return res.status(200).json({ states });
  }
  if (req.method === 'POST') {
    const auth = getAuthFromCookies(req.headers.cookie);
    if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    try {
      const s = await prisma.state.create({ data: { name } });
      return res.status(201).json({ id: s.id });
    } catch (e) {
      return res.status(409).json({ error: 'Estado ya existe' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
