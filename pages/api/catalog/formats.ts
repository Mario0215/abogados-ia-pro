import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const matter = typeof req.query.matter === 'string' ? req.query.matter : undefined;
  const where: any = { active: true, jurisdiccion: 'FORMATO' };
  if (matter) where.matter = matter;
  const documents = await prisma.document.findMany({
    where,
    orderBy: { title: 'asc' },
    select: { id: true, title: true, matter: true }
  });
  return res.status(200).json({ formats: documents });
}
