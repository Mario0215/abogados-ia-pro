import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  if (req.method === 'POST') {
    const { stateId, matter } = req.body || {};
    if (!matter) return res.status(400).json({ error: 'Materia requerida' });
    try {
      const c = await prisma.consultation.create({
        data: {
          userId: auth.uid,
          stateId: stateId || null,
          matter
        }
      });
      return res.status(201).json({ id: c.id });
    } catch (e) {
      return res.status(400).json({ error: 'Error creando consulta' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
