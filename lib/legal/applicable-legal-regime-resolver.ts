import {
  type LegalApplicabilityResultCode,
  type LegalRegimeCode,
  type SupportedLegalMatter,
  type SupportedLegalTerritory,
  isLegalApplicabilityResult,
  isLegalRegime,
  normalizeLegalMatter,
  normalizeLegalTerritory
} from './constants';

export type LegalRuleCandidate = {
  id?: string;
  ruleKey: string;
  kind: 'APPLICABILITY' | 'TRANSITION' | 'BASELINE';
  matter: SupportedLegalMatter;
  territory: SupportedLegalTerritory;
  procedure?: string | null;
  phase?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  priority: number;
  result: LegalApplicabilityResultCode;
  regime?: LegalRegimeCode | null;
  explanation: string;
  ruleVersion: string;
  active?: boolean;
  permittedNormVersionIds?: string[];
};

export type ApplicableLegalRegimeInput = {
  matter: string;
  jurisdiction: string;
  procedure?: string | null;
  relevantDate?: Date | string | null;
  phase?: string | null;
  caseContext?: Record<string, unknown> | null;
  rules?: LegalRuleCandidate[];
  humanOverride?: {
    actorUserId?: string | null;
    reason?: string | null;
    result?: LegalApplicabilityResultCode | string | null;
    regime?: LegalRegimeCode | string | null;
    permittedNormVersionIds?: string[];
  } | null;
};

export type ApplicableLegalRegimeResolution = {
  result: LegalApplicabilityResultCode;
  regime: LegalRegimeCode | null;
  appliedRule: {
    id?: string;
    ruleKey: string;
    kind: LegalRuleCandidate['kind'];
    ruleVersion: string;
  } | null;
  explanation: string;
  evaluatedAt: Date;
  relevantDate: Date | null;
  permittedNormVersionIds: string[];
  isHumanOverride: boolean;
  overrideActorUserId: string | null;
  overrideReason: string | null;
};

function exactOrUnset(ruleValue: string | null | undefined, requested: string | null | undefined): boolean {
  if (!ruleValue) return true;
  if (!requested) return false;
  return ruleValue.trim().toUpperCase() === requested.trim().toUpperCase();
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ruleMatches(rule: LegalRuleCandidate, input: {
  matter: SupportedLegalMatter;
  territory: SupportedLegalTerritory;
  procedure?: string | null;
  phase?: string | null;
  relevantDate: Date;
}): boolean {
  if (rule.active === false || rule.matter !== input.matter || rule.territory !== input.territory) return false;
  if (!exactOrUnset(rule.procedure, input.procedure)) return false;
  if (!exactOrUnset(rule.phase, input.phase)) return false;
  const from = toDate(rule.effectiveFrom);
  const to = toDate(rule.effectiveTo);
  if (from && input.relevantDate < from) return false;
  if (to && input.relevantDate > to) return false;
  return true;
}

function specificity(rule: LegalRuleCandidate): number {
  return (rule.procedure ? 1 : 0) + (rule.phase ? 1 : 0) + (rule.effectiveFrom ? 1 : 0) + (rule.effectiveTo ? 1 : 0);
}

function resolution(
  result: LegalApplicabilityResultCode,
  regime: LegalRegimeCode | null,
  explanation: string,
  relevantDate: Date | null,
  appliedRule: ApplicableLegalRegimeResolution['appliedRule'] = null,
  permittedNormVersionIds: string[] = [],
  override?: { actorUserId: string | null; reason: string | null }
): ApplicableLegalRegimeResolution {
  return {
    result,
    regime,
    appliedRule,
    explanation,
    evaluatedAt: new Date(),
    relevantDate,
    permittedNormVersionIds: [...new Set(permittedNormVersionIds)],
    isHumanOverride: Boolean(override),
    overrideActorUserId: override?.actorUserId ?? null,
    overrideReason: override?.reason ?? null
  };
}

/**
 * Resuelve una regla de régimen sin IA. Este objeto puro se puede probar y usar
 * desde una API o job sin depender de Prisma ni de un proveedor externo.
 */
export class ApplicableLegalRegimeResolver {
  resolve(input: ApplicableLegalRegimeInput): ApplicableLegalRegimeResolution {
    const matter = normalizeLegalMatter(input.matter);
    if (!matter) {
      return resolution(
        'BLOCKED',
        null,
        'La materia solicitada está fuera del alcance jurídico habilitado para Abogados IA Pro.',
        toDate(input.relevantDate)
      );
    }

    const territory = normalizeLegalTerritory(input.jurisdiction);
    if (!territory) {
      return resolution(
        'BLOCKED',
        null,
        'La jurisdicción solicitada no pertenece al alcance inicial de Guanajuato y legislación federal/nacional aplicable.',
        toDate(input.relevantDate)
      );
    }

    const relevantDate = toDate(input.relevantDate);
    if (!relevantDate) {
      return resolution(
        'REQUIRES_REVIEW',
        null,
        'Falta una fecha relevante verificable para resolver vigencia o transición normativa.',
        null
      );
    }

    const override = input.humanOverride;
    if (override) {
      const overrideResult = isLegalApplicabilityResult(override.result) ? override.result : null;
      const overrideRegime = isLegalRegime(override.regime) ? override.regime : null;
      if (!override.actorUserId || !override.reason || !overrideResult || (overrideResult === 'RESOLVED' && !overrideRegime)) {
        return resolution(
          'REQUIRES_REVIEW',
          null,
          'El override humano carece de actor, motivo o régimen auditable.',
          relevantDate
        );
      }
      return resolution(
        overrideResult,
        overrideResult === 'RESOLVED' ? overrideRegime : null,
        `Override humano auditado: ${override.reason}`,
        relevantDate,
        { ruleKey: 'HUMAN_OVERRIDE', kind: 'BASELINE', ruleVersion: 'AUDITABLE_OVERRIDE_V1' },
        override.permittedNormVersionIds ?? [],
        { actorUserId: override.actorUserId, reason: override.reason }
      );
    }

    const matchingRules = (input.rules ?? []).filter((rule) => ruleMatches(rule, {
      matter,
      territory,
      procedure: input.procedure,
      phase: input.phase,
      relevantDate
    }));

    if (matchingRules.length === 0 && matter === 'LABORAL') {
      return resolution(
        'RESOLVED',
        'LABORAL_FEDERAL',
        'Régimen laboral federal base: la Ley Federal del Trabajo debe complementarse con reglas operativas verificadas para cada servicio y fase.',
        relevantDate,
        { ruleKey: 'LABORAL_FEDERAL_BASELINE', kind: 'BASELINE', ruleVersion: '1.0.0' }
      );
    }

    if (matchingRules.length === 0) {
      return resolution(
        'REQUIRES_REVIEW',
        null,
        'No existe una regla de aplicabilidad o transición activa que cubra materia, territorio, procedimiento, fase y fecha indicados.',
        relevantDate
      );
    }

    const ordered = [...matchingRules].sort((a, b) => {
      const priority = b.priority - a.priority;
      if (priority !== 0) return priority;
      const detail = specificity(b) - specificity(a);
      if (detail !== 0) return detail;
      return a.ruleKey.localeCompare(b.ruleKey);
    });
    const winner = ordered[0];
    const tied = ordered.filter((candidate) => candidate.priority === winner.priority && specificity(candidate) === specificity(winner));
    const outcomes = new Set(tied.map((candidate) => `${candidate.result}:${candidate.regime ?? ''}`));
    if (outcomes.size > 1) {
      return resolution(
        'REQUIRES_REVIEW',
        null,
        'Existen reglas de igual prioridad con resultados incompatibles; se requiere revisión humana antes de usar una versión normativa.',
        relevantDate
      );
    }

    if (winner.result !== 'RESOLVED') {
      return resolution(
        winner.result,
        null,
        winner.explanation,
        relevantDate,
        { id: winner.id, ruleKey: winner.ruleKey, kind: winner.kind, ruleVersion: winner.ruleVersion },
        winner.permittedNormVersionIds ?? []
      );
    }

    if (!winner.regime) {
      return resolution(
        'REQUIRES_REVIEW',
        null,
        `La regla ${winner.ruleKey} está activa pero no define un régimen aplicable.`,
        relevantDate,
        { id: winner.id, ruleKey: winner.ruleKey, kind: winner.kind, ruleVersion: winner.ruleVersion }
      );
    }

    return resolution(
      'RESOLVED',
      winner.regime,
      winner.explanation,
      relevantDate,
      { id: winner.id, ruleKey: winner.ruleKey, kind: winner.kind, ruleVersion: winner.ruleVersion },
      winner.permittedNormVersionIds ?? []
    );
  }
}

export const applicableLegalRegimeResolver = new ApplicableLegalRegimeResolver();
