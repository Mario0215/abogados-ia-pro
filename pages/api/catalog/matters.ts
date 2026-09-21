import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

const defaults = [
  { key: 'CIVIL', label: 'Civil' },
  { key: 'PENAL', label: 'Penal' },
  { key: 'MERCANTIL', label: 'Mercantil' },
  { key: 'LABORAL', label: 'Laboral' }
];

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const existing = await prisma.matterConfig.findMany();
  if (existing.length === 0) {
    for (const d of defaults) {
      await prisma.matterConfig.create({ data: { key: d.key, label: d.label, active: true } });
    }
  }
  const matters = await prisma.matterConfig.findMany({ orderBy: { label: 'asc' } });
  return res.status(200).json({ matters });
}
