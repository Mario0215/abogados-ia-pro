import type { NextApiRequest, NextApiResponse } from 'next';
import { LegalTerritory } from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import {
  isLegalApplicabilityResult,
  isLegalRegime,
  isSupportedLegalMatter
} from '../../../../lib/legal/constants';
import { resolveAndRecordCaseLegalRegime } from '../../../../lib/legal/regime-decision-service';
import { prisma } from '../../../../lib/prisma';

function optionalDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Fecha inválida.');
  return date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const caseId = typeof req.query.caseId === 'string' ? req.query.caseId : null;
    if (!caseId) return res.status(400).json({ error: 'Expediente requerido.' });
    const [context, decisions] = await Promise.all([
      prisma.caseLegalContext.findUnique({ where: { caseId } }),
      prisma.caseLegalRegimeDecision.findMany({
        where: { caseId },
        include: { permittedVersions: { include: { normVersion: { include: { norm: true } } } }, applicabilityRule: true, transitionRule: true },
        orderBy: { evaluatedAt: 'desc' }
      })
    ]);
    return res.status(200).json({ context, decisions });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { action, caseId } = req.body ?? {};
    if (typeof caseId !== 'string') return res.status(400).json({ error: 'Expediente requerido.' });
    if (action === 'setContext') {
      const { matter, territory, procedure, municipality, court, startDate, filingDate, proceduralPhase, contextData } = req.body ?? {};
      if (!isSupportedLegalMatter(matter) || !Object.values(LegalTerritory).includes(territory as LegalTerritory)) {
        return res.status(400).json({ error: 'Materia o territorio fuera del alcance permitido.' });
      }
      const legalCase = await prisma.legalCase.findUnique({ where: { id: caseId }, select: { id: true } });
      if (!legalCase) return res.status(404).json({ error: 'Expediente no encontrado.' });
      const context = await prisma.caseLegalContext.upsert({
        where: { caseId },
        create: {
          caseId,
          matter,
          territory,
          procedure: typeof procedure === 'string' ? procedure.trim() || null : null,
          municipality: typeof municipality === 'string' ? municipality.trim() || null : null,
          court: typeof court === 'string' ? court.trim() || null : null,
          startDate: optionalDate(startDate),
          filingDate: optionalDate(filingDate),
          proceduralPhase: typeof proceduralPhase === 'string' ? proceduralPhase.trim() || null : null,
          contextData: contextData && typeof contextData === 'object' ? contextData : undefined
        },
        update: {
          matter,
          territory,
          procedure: typeof procedure === 'string' ? procedure.trim() || null : null,
          municipality: typeof municipality === 'string' ? municipality.trim() || null : null,
          court: typeof court === 'string' ? court.trim() || null : null,
          startDate: optionalDate(startDate),
          filingDate: optionalDate(filingDate),
          proceduralPhase: typeof proceduralPhase === 'string' ? proceduralPhase.trim() || null : null,
          contextData: contextData && typeof contextData === 'object' ? contextData : undefined
        }
      });
      return res.status(200).json({ context });
    }
    if (action === 'resolve') {
      const override = req.body?.humanOverride;
      if (override && (!isLegalApplicabilityResult(override.result) || (override.result === 'RESOLVED' && !isLegalRegime(override.regime)) || typeof override.reason !== 'string' || !override.reason.trim())) {
        return res.status(400).json({ error: 'Override humano inválido o sin motivo.' });
      }
      const result = await resolveAndRecordCaseLegalRegime(prisma, {
        caseId,
        actorUserId: auth.uid,
        relevantDate: optionalDate(req.body?.relevantDate),
        humanOverride: override ? {
          actorUserId: auth.uid,
          reason: override.reason,
          result: override.result,
          regime: override.regime,
          permittedNormVersionIds: Array.isArray(override.permittedNormVersionIds)
            ? override.permittedNormVersionIds.filter((id: unknown): id is string => typeof id === 'string')
            : []
        } : null
      });
      return res.status(201).json(result);
    }
    return res.status(400).json({ error: 'Acción de régimen no reconocida.' });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo guardar la decisión jurídica.' });
  }
}
