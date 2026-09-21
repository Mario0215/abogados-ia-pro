import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../../../../lib/auth';
import { getCaseFinancialSummary } from '../../../../../lib/finance';
import { prisma } from '../../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const caseId = String(req.query.id || '').trim();
  if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

  const summary = await getCaseFinancialSummary(prisma as any, caseId);
  if (!summary) return res.status(404).json({ error: 'Caso no encontrado' });
  return res.status(200).json({ summary });
}
