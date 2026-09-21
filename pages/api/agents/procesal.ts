import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { ProcesalAgent } from '../../../lib/agents/procesal.agent';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  const { caseId } = req.body || {};
  const id = typeof caseId === 'string' ? caseId : '';
  if (!id) return res.status(400).json({ error: 'caseId requerido' });
  const lc = await prisma.legalCase.findUnique({ where: { id } });
  if (!canAccessLegalCase(auth, lc)) return res.status(404).json({ error: 'Caso no encontrado' });
  try {
    const agent = new ProcesalAgent(id);
    const analysis = await agent.analyze();
    return res.status(200).json(analysis);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error ejecutando agente procesal' });
  }
}
