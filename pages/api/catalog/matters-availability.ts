import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

const defaults = [
  { key: 'CIVIL', label: 'Civil' },
  { key: 'PENAL', label: 'Penal' },
  { key: 'MERCANTIL', label: 'Mercantil' },
  { key: 'LABORAL', label: 'Laboral' }
];

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const configs = await prisma.matterConfig.findMany();
  const list = configs.length
    ? configs.map(m => ({ key: m.key, label: m.label }))
    : defaults;
  const results = await Promise.all(
    list.map(async m => {
      const count = await prisma.document.count({ where: { active: true, matter: m.key } });
      return { key: m.key, label: m.label, active: count > 0 };
    })
  );
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800');
  return res.status(200).json({ matters: results });
}
