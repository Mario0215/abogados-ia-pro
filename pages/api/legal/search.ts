import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import {
  LegalSearchScopeError,
  recordLegalRagCitations,
  searchLegalProvisions
} from '../../../lib/legal/controlled-search';
import { prisma } from '../../../lib/prisma';

/**
 * Búsqueda del nuevo núcleo jurídico. La persona usuaria nunca decide por sí
 * sola las versiones: se toman de una decisión registrada para el expediente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ADMIN' && auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });

  const { caseId, decisionId, query, comparative } = req.body ?? {};
  if (typeof caseId !== 'string' || typeof query !== 'string' || !query.trim() || query.length > 2_000) {
    return res.status(400).json({ error: 'Expediente y consulta jurídica válida son requeridos.' });
  }
  const legalCase = await prisma.legalCase.findUnique({ where: { id: caseId } });
  if (!canAccessLegalCase(auth, legalCase)) return res.status(403).json({ error: 'Sin acceso al expediente.' });
  const context = await prisma.caseLegalContext.findUnique({ where: { caseId } });
  if (!context) return res.status(409).json({ error: 'El expediente no tiene contexto jurídico estructurado.' });

  const decision = await prisma.caseLegalRegimeDecision.findFirst({
    where: {
      caseId,
      ...(typeof decisionId === 'string' ? { id: decisionId } : {})
    },
    include: { permittedVersions: true },
    orderBy: { evaluatedAt: 'desc' }
  });
  if (!decision) return res.status(409).json({ error: 'No existe una decisión de régimen para el expediente.' });
  if (decision.result !== 'RESOLVED') {
    return res.status(409).json({ error: 'La decisión jurídica requiere revisión o está bloqueada; no se permite recuperar normativa.' });
  }
  const allowedNormVersionIds = decision.permittedVersions.map((item) => item.normVersionId);
  if (!allowedNormVersionIds.length) {
    return res.status(409).json({ error: 'La decisión resuelta no tiene versiones normativas permitidas.' });
  }

  try {
    const results = await searchLegalProvisions(prisma, {
      matter: context.matter,
      allowedNormVersionIds,
      query,
      comparative: comparative === true
    });
    const response = {
      caseId,
      decisionId: decision.id,
      matter: context.matter,
      comparative: comparative === true,
      results,
      vectorSearchAvailable: false
    };
    await recordLegalRagCitations(prisma, { caseId, decisionId: decision.id, query, response, results });
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof LegalSearchScopeError) {
      return res.status(error.code === 'BLOCKED_MATTER' ? 403 : 409).json({ error: error.message, code: error.code });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Error en búsqueda jurídica controlada.' });
  }
}
