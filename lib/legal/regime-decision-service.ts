import type { PrismaClient } from '@prisma/client';
import {
  applicableLegalRegimeResolver,
  type ApplicableLegalRegimeInput,
  type LegalRuleCandidate
} from './applicable-legal-regime-resolver';

function asCandidate(rule: {
  id: string;
  ruleKey: string;
  matter: 'CIVIL' | 'FAMILIAR' | 'LABORAL';
  territory: 'GUANAJUATO' | 'FEDERAL_NACIONAL';
  procedure: string | null;
  phase: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  priority: number;
  result: 'RESOLVED' | 'REQUIRES_REVIEW' | 'BLOCKED';
  regime: 'CPC_GTO_LEGACY' | 'CNPCF' | 'LABORAL_FEDERAL' | null;
  explanation: string;
  ruleVersion: string;
  active: boolean;
  targetNormVersionId?: string | null;
  toNormVersionId?: string | null;
}, kind: LegalRuleCandidate['kind']): LegalRuleCandidate {
  return {
    id: rule.id,
    ruleKey: rule.ruleKey,
    kind,
    matter: rule.matter,
    territory: rule.territory,
    procedure: rule.procedure,
    phase: rule.phase,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    priority: rule.priority,
    result: rule.result,
    regime: rule.regime,
    explanation: rule.explanation,
    ruleVersion: rule.ruleVersion,
    active: rule.active,
    permittedNormVersionIds: [rule.targetNormVersionId, rule.toNormVersionId].filter((value): value is string => Boolean(value))
  };
}

export type ResolveCaseLegalRegimeInput = {
  caseId: string;
  actorUserId?: string | null;
  relevantDate?: Date | null;
  humanOverride?: ApplicableLegalRegimeInput['humanOverride'];
};

/**
 * Evalúa y registra la decisión de régimen para un expediente. No se invoca
 * desde redacción/generación; el flujo humano debe llamarlo explícitamente.
 */
export async function resolveAndRecordCaseLegalRegime(prisma: PrismaClient, input: ResolveCaseLegalRegimeInput) {
  const context = await prisma.caseLegalContext.findUnique({ where: { caseId: input.caseId } });
  if (!context) throw new Error('El expediente no tiene contexto jurídico estructurado.');

  const [applicabilityRules, transitionRules] = await Promise.all([
    prisma.legalApplicabilityRule.findMany({
      where: { matter: context.matter, territory: context.territory, active: true }
    }),
    prisma.legalTransitionRule.findMany({
      where: { matter: context.matter, territory: context.territory, active: true }
    })
  ]);
  const rules = [
    ...applicabilityRules.map((rule) => asCandidate(rule, 'APPLICABILITY')),
    ...transitionRules.map((rule) => asCandidate(rule, 'TRANSITION'))
  ];
  const relevantDate = input.relevantDate ?? context.filingDate ?? context.startDate ?? null;
  const resolution = applicableLegalRegimeResolver.resolve({
    matter: context.matter,
    jurisdiction: context.territory,
    procedure: context.procedure,
    phase: context.proceduralPhase,
    relevantDate,
    caseContext: context.contextData && typeof context.contextData === 'object' ? context.contextData as Record<string, unknown> : null,
    rules,
    humanOverride: input.humanOverride
  });
  const selectedRule = rules.find((rule) => rule.ruleKey === resolution.appliedRule?.ruleKey);
  const decision = await prisma.caseLegalRegimeDecision.create({
    data: {
      caseId: input.caseId,
      contextId: context.id,
      applicabilityRuleId: selectedRule?.kind === 'APPLICABILITY' ? selectedRule.id : null,
      transitionRuleId: selectedRule?.kind === 'TRANSITION' ? selectedRule.id : null,
      result: resolution.result,
      regime: resolution.regime,
      explanation: resolution.explanation,
      ruleVersion: resolution.appliedRule?.ruleVersion ?? null,
      relevantDate: resolution.relevantDate,
      evaluatedAt: resolution.evaluatedAt,
      isHumanOverride: resolution.isHumanOverride,
      overrideReason: resolution.overrideReason,
      actorUserId: input.actorUserId ?? null,
      overrideActorUserId: resolution.overrideActorUserId,
      permittedVersions: resolution.permittedNormVersionIds.length ? {
        create: resolution.permittedNormVersionIds.map((normVersionId) => ({ normVersionId }))
      } : undefined
    },
    include: { permittedVersions: true }
  });
  return { resolution, decision };
}
