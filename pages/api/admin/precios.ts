import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const [servicios, modificadores] = await Promise.all([
      (prisma as any).servicioConfig.findMany({ orderBy: { servicioId: 'asc' } }),
      (prisma as any).precioModificador.findMany({ orderBy: { key: 'asc' } }),
    ]);
    return res.status(200).json({ servicios, modificadores });
  }

  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'PUT') {
    const { servicioId, precioBase, modificadorKey, valor } = req.body || {};

    if (servicioId) {
      const id = String(servicioId);
      const price = Number(precioBase);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'precioBase inválido' });
      const updated = await (prisma as any).servicioConfig.update({
        where: { servicioId: id },
        data: { precioBase: Math.round(price) },
      });
      return res.status(200).json({ servicio: updated });
    }

    if (modificadorKey) {
      const key = String(modificadorKey);
      const v = Number(valor);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'valor inválido' });
      const updated = await (prisma as any).precioModificador.update({
        where: { key },
        data: { valor: Math.round(v) },
      });
      return res.status(200).json({ modificador: updated });
    }

    return res.status(400).json({ error: 'Body inválido' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

