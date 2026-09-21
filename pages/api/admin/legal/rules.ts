import type { NextApiRequest, NextApiResponse } from 'next';
import {
  LegalApplicabilityResult,
  LegalRegime,
  LegalTerritory,
  LegalSourceStatus,
  LegalSourceTrustLevel
} from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import { isSupportedLegalMatter } from '../../../../lib/legal/constants';
import { prisma } from '../../../../lib/prisma';

function isAdmin(req: NextApiRequest): boolean {
  return getAuthFromCookies(req.headers.cookie)?.role === 'ADMIN';
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Fecha de regla inválida.');
  return parsed;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function ensureActiveRuleSource(sourceId: string | null, active: boolean) {
  if (!active) return;
  if (!sourceId) throw new Error('Una regla activa requiere una fuente oficial activa.');
  const source = await prisma.legalSource.findUnique({ where: { id: sourceId } });
  if (!source || source.status !== LegalSourceStatus.ACTIVE || source.trustLevel === LegalSourceTrustLevel.CURATED_INTERNAL) {
    throw new Error('La fuente de la regla debe estar activa y tener confianza oficial.');
  }
}

function validateBase(body: Record<string, unknown>) {
  const matter = body.matter;
  const territory = body.territory;
  const result = body.result;
  const regime = body.regime;
  if (typeof body.ruleKey !== 'string' || !/^[A-Z0-9_\-]{3,120}$/.test(body.ruleKey.trim()) || typeof body.name !== 'string' || body.name.trim().length < 3 || !isSupportedLegalMatter(matter) || (territory !== LegalTerritory.GUANAJUATO && territory !== LegalTerritory.FEDERAL_NACIONAL) || !Object.values(LegalApplicabilityResult).includes(result as LegalApplicabilityResult) || typeof body.explanation !== 'string' || body.explanation.trim().length < 8 || typeof body.ruleVersion !== 'string' || !body.ruleVersion.trim()) {
    throw new Error('Datos de regla inválidos o fuera del alcance habilitado.');
  }
  if (result === LegalApplicabilityResult.RESOLVED && !Object.values(LegalRegime).includes(regime as LegalRegime)) {
    throw new Error('Una regla RESOLVED requiere régimen jurídico.');
  }
  return {
    ruleKey: body.ruleKey.trim(),
    name: body.name.trim(),
    matter,
    territory: territory as LegalTerritory,
    procedure: nullableText(body.procedure),
    phase: nullableText(body.phase),
    effectiveFrom: parseDate(body.effectiveFrom),
    effectiveTo: parseDate(body.effectiveTo),
    priority: Number.isInteger(body.priority) ? Number(body.priority) : 0,
    result: result as LegalApplicabilityResult,
    regime: result === LegalApplicabilityResult.RESOLVED ? regime as LegalRegime : null,
    explanation: body.explanation.trim(),
    ruleVersion: body.ruleVersion.trim(),
    sourceId: nullableText(body.sourceId),
    active: body.active === true
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const [applicabilityRules, transitionRules] = await Promise.all([
      prisma.legalApplicabilityRule.findMany({ include: { source: true, targetNorm: true, targetNormVersion: true }, orderBy: [{ active: 'desc' }, { priority: 'desc' }] }),
      prisma.legalTransitionRule.findMany({ include: { source: true, fromNorm: true, toNorm: true, fromNormVersion: true, toNormVersion: true }, orderBy: [{ active: 'desc' }, { priority: 'desc' }] })
    ]);
    return res.status(200).json({ applicabilityRules, transitionRules });
  }

  if (req.method === 'POST') {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const kind = body.kind;
      if (kind !== 'APPLICABILITY' && kind !== 'TRANSITION') return res.status(400).json({ error: 'Tipo de regla inválido.' });
      const base = validateBase(body);
      if (base.effectiveFrom && base.effectiveTo && base.effectiveFrom > base.effectiveTo) {
        return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final.' });
      }
      await ensureActiveRuleSource(base.sourceId, base.active);
      if (kind === 'APPLICABILITY') {
        const rule = await prisma.legalApplicabilityRule.create({
          data: {
            ...base,
            targetNormId: nullableText(body.targetNormId),
            targetNormVersionId: nullableText(body.targetNormVersionId)
          }
        });
        return res.status(201).json({ rule });
      }
      const rule = await prisma.legalTransitionRule.create({
        data: {
          ...base,
          fromNormId: nullableText(body.fromNormId),
          toNormId: nullableText(body.toNormId),
          fromNormVersionId: nullableText(body.fromNormVersionId),
          toNormVersionId: nullableText(body.toNormVersionId)
        }
      });
      return res.status(201).json({ rule });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo crear la regla.' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, kind, active, retirementReason } = req.body ?? {};
    if (typeof id !== 'string' || (kind !== 'APPLICABILITY' && kind !== 'TRANSITION') || typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Datos de retiro inválidos.' });
    }
    if (!active && (typeof retirementReason !== 'string' || !retirementReason.trim())) {
      return res.status(400).json({ error: 'El retiro no destructivo requiere motivo.' });
    }
    if (kind === 'APPLICABILITY') {
      const rule = await prisma.legalApplicabilityRule.update({
        where: { id },
        data: active ? { active: true, retiredAt: null, retirementReason: null } : { active: false, retiredAt: new Date(), retirementReason: retirementReason.trim() }
      });
      return res.status(200).json({ rule });
    }
    const rule = await prisma.legalTransitionRule.update({
      where: { id },
      data: active ? { active: true, retiredAt: null, retirementReason: null } : { active: false, retiredAt: new Date(), retirementReason: retirementReason.trim() }
    });
    return res.status(200).json({ rule });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
