import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const { caseId } = req.query;
    if (!caseId) return res.status(400).json({ error: 'caseId requerido' });
    try {
      const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, userId: true, abogadoId: true } });
      if (!canAccessLegalCase(auth, lc as any, true)) return res.status(404).json({ error: 'Caso no encontrado' });
      const rows = await prisma.$queryRawUnsafe<Array<{ questionnaireData: string | null }>>(
        `SELECT "questionnaireData" FROM "LegalCase" WHERE "id" = $1`,
        String(caseId)
      );
      if (!rows?.length) return res.status(404).json({ error: 'Caso no encontrado' });
      const data = rows[0].questionnaireData ? JSON.parse(rows[0].questionnaireData) : null;
      return res.status(200).json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  }

  if (req.method === 'POST') {
    const { caseId, data } = req.body || {};
    if (!caseId || !data) return res.status(400).json({ error: 'caseId y data requeridos' });
    try {
      const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, userId: true, abogadoId: true } });
      if (!canAccessLegalCase(auth, lc as any, true)) return res.status(404).json({ error: 'Caso no encontrado' });
      await prisma.$executeRawUnsafe(
        `UPDATE "LegalCase" SET "questionnaireData" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        JSON.stringify(data), String(caseId)
      );
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
