import assert from 'node:assert/strict';
import {
  ApplicableLegalRegimeResolver,
  LegalSearchScopeError,
  assertNoNormVersionMix,
  deriveLegalNormVersionStatus,
  isSupportedLegalMatter,
  previewLegalStructure
} from '../lib/legal';

function test(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    throw error;
  }
}

const resolver = new ApplicableLegalRegimeResolver();

test('enum restringe materias a Civil, Familiar y Laboral', () => {
  assert.equal(isSupportedLegalMatter('CIVIL'), true);
  assert.equal(isSupportedLegalMatter('FAMILIAR'), true);
  assert.equal(isSupportedLegalMatter('LABORAL'), true);
  assert.equal(isSupportedLegalMatter('PENAL'), false);
  assert.equal(isSupportedLegalMatter('MERCANTIL'), false);
});

test('resolver bloquea Penal y Mercantil', () => {
  for (const matter of ['PENAL', 'MERCANTIL']) {
    const result = resolver.resolve({ matter, jurisdiction: 'GUANAJUATO', relevantDate: new Date('2026-01-01') });
    assert.equal(result.result, 'BLOCKED');
    assert.equal(result.regime, null);
  }
});

test('resolver devuelve régimen legado con regla determinista', () => {
  const result = resolver.resolve({
    matter: 'CIVIL',
    jurisdiction: 'GUANAJUATO',
    procedure: 'ORDINARIO',
    phase: 'INICIAL',
    relevantDate: new Date('2026-01-01'),
    rules: [{
      id: 'rule-cpc',
      ruleKey: 'CPC_GTO_LEGACY_INITIAL',
      kind: 'TRANSITION',
      matter: 'CIVIL',
      territory: 'GUANAJUATO',
      procedure: 'ORDINARIO',
      phase: 'INICIAL',
      effectiveTo: new Date('2026-12-31'),
      priority: 100,
      result: 'RESOLVED',
      regime: 'CPC_GTO_LEGACY',
      explanation: 'Regla local revisada.',
      ruleVersion: '1.0.0',
      permittedNormVersionIds: ['cpc-v1']
    }]
  });
  assert.equal(result.result, 'RESOLVED');
  assert.equal(result.regime, 'CPC_GTO_LEGACY');
  assert.equal(result.appliedRule?.ruleKey, 'CPC_GTO_LEGACY_INITIAL');
  assert.deepEqual(result.permittedNormVersionIds, ['cpc-v1']);
});

test('resolver exige revisión si hay reglas ambiguas', () => {
  const shared = {
    matter: 'FAMILIAR' as const,
    territory: 'GUANAJUATO' as const,
    priority: 50,
    result: 'RESOLVED' as const,
    explanation: 'Regla con misma prioridad.',
    ruleVersion: '1.0.0'
  };
  const result = resolver.resolve({
    matter: 'FAMILIAR',
    jurisdiction: 'GUANAJUATO',
    relevantDate: new Date('2026-01-01'),
    rules: [
      { ...shared, ruleKey: 'TRANSICION_A', kind: 'TRANSITION', regime: 'CPC_GTO_LEGACY' },
      { ...shared, ruleKey: 'TRANSICION_B', kind: 'TRANSITION', regime: 'CNPCF' }
    ]
  });
  assert.equal(result.result, 'REQUIRES_REVIEW');
  assert.equal(result.regime, null);
});

test('resolver laboral usa baseline federal sin LLM', () => {
  const result = resolver.resolve({ matter: 'LABORAL', jurisdiction: 'GUANAJUATO', relevantDate: new Date('2026-01-01') });
  assert.equal(result.result, 'RESOLVED');
  assert.equal(result.regime, 'LABORAL_FEDERAL');
  assert.equal(result.appliedRule?.kind, 'BASELINE');
});

test('override requiere actor, motivo y régimen auditable', () => {
  const incomplete = resolver.resolve({
    matter: 'CIVIL', jurisdiction: 'GUANAJUATO', relevantDate: new Date('2026-01-01'),
    humanOverride: { result: 'RESOLVED', regime: 'CNPCF', reason: 'Sin actor' }
  });
  assert.equal(incomplete.result, 'REQUIRES_REVIEW');
  const accepted = resolver.resolve({
    matter: 'CIVIL', jurisdiction: 'GUANAJUATO', relevantDate: new Date('2026-01-01'),
    humanOverride: { actorUserId: 'admin-1', result: 'RESOLVED', regime: 'CNPCF', reason: 'Acuerdo transitorio verificado.', permittedNormVersionIds: ['cnpcf-v1'] }
  });
  assert.equal(accepted.isHumanOverride, true);
  assert.equal(accepted.regime, 'CNPCF');
});

test('no mezcla versiones de una misma norma salvo comparación explícita', () => {
  assert.throws(
    () => assertNoNormVersionMix([{ normId: 'CPC_GTO', normVersionId: 'v1' }, { normId: 'CPC_GTO', normVersionId: 'v2' }]),
    (error: unknown) => error instanceof LegalSearchScopeError && error.code === 'VERSION_MIX'
  );
  assert.doesNotThrow(() => assertNoNormVersionMix([{ normId: 'CC_GTO', normVersionId: 'v1' }, { normId: 'CPC_GTO', normVersionId: 'v2' }]));
  assert.doesNotThrow(() => assertNoNormVersionMix([{ normId: 'CPC_GTO', normVersionId: 'v1' }, { normId: 'CPC_GTO', normVersionId: 'v2' }], true));
});

test('clasifica vigencia CURRENT, FUTURE e HISTORICAL', () => {
  const asOf = new Date('2026-06-01T12:00:00Z');
  assert.equal(deriveLegalNormVersionStatus({ effectiveFrom: new Date('2026-01-01'), effectiveTo: null }, asOf), 'CURRENT');
  assert.equal(deriveLegalNormVersionStatus({ effectiveFrom: new Date('2027-01-01'), effectiveTo: null }, asOf), 'FUTURE');
  assert.equal(deriveLegalNormVersionStatus({ effectiveFrom: new Date('2025-01-01'), effectiveTo: new Date('2026-01-01') }, asOf), 'HISTORICAL');
});

test('previsualización conserva jerarquía y artículos sin persistir texto', () => {
  const preview = previewLegalStructure('LIBRO PRIMERO\nTÍTULO I\nCAPÍTULO I\nArtículo 10. Texto íntegro del artículo.\nI. Fracción primera.');
  assert.equal(preview.provisions.some((provision) => provision.type === 'ARTICLE' && provision.designation === '10'), true);
  assert.equal(preview.provisions.some((provision) => provision.type === 'FRACTION'), true);
  assert.equal(preview.sourceHash.length, 64);
});

process.stdout.write('Núcleo jurídico puro: pruebas aprobadas.\n');
