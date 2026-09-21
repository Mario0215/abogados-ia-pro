import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const { q } = req.query || {};
    const clients = await prisma.client.findMany({
      where: { userId: auth.uid, name: q ? { contains: String(q) } : undefined },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
    res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=600');
    return res.status(200).json({ clients });
  }

  if (req.method === 'POST') {
    const { name, phone, email, address } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const existing = await prisma.client.findFirst({ where: { userId: auth.uid, name: String(name) } });
    const c = existing
      ? await prisma.client.update({
          where: { id: existing.id },
          data: {
            phone: phone ? String(phone) : existing.phone,
            email: email ? String(email) : existing.email,
            address: address ? String(address) : existing.address
          }
        })
      : await prisma.client.create({
          data: { userId: auth.uid, name: String(name), phone: phone ? String(phone) : null, email: email ? String(email) : null, address: address ? String(address) : null }
        });
    return res.status(201).json({ id: c.id });
  }

  if (req.method === 'PUT') {
    const { id, name, phone, email, address } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.client.findUnique({ where: { id } });
    if (!before || before.userId !== auth.uid) return res.status(404).json({ error: 'No encontrado' });
    const c = await prisma.client.update({
      where: { id },
      data: {
        name: name ? String(name) : before.name,
        phone: phone ? String(phone) : before.phone,
        email: email ? String(email) : before.email,
        address: address ? String(address) : before.address
      }
    });
    return res.status(200).json({ id: c.id });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.client.findUnique({ where: { id } });
    if (!before || before.userId !== auth.uid) return res.status(404).json({ error: 'No encontrado' });
    await prisma.client.delete({ where: { id } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
