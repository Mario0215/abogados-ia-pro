import { createHash } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { normalizeLegalMatter, type SupportedLegalMatter } from './constants';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export class LegalSearchScopeError extends Error {
  constructor(public readonly code: 'BLOCKED_MATTER' | 'INVALID_SCOPE' | 'VERSION_MIX', message: string) {
    super(message);
    this.name = 'LegalSearchScopeError';
  }
}

export type ControlledLegalSearchInput = {
  matter: string;
  allowedNormVersionIds: string[];
  query: string;
  limit?: number;
  comparative?: boolean;
  queryVector?: number[];
};

export type ControlledLegalSearchResult = {
  provisionId: string;
  type: string;
  designation: string;
  heading: string | null;
  fullText: string;
  score: number;
  match: 'EXACT_ARTICLE' | 'LEXICAL' | 'VECTOR';
  norm: {
    id: string;
    canonicalId: string;
    officialName: string;
  };
  version: {
    id: string;
    versionKey: string;
    status: string;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  };
  source: {
    id: string;
    authority: string;
    url: string;
    trustLevel: string;
    capturedAt: Date;
    contentHash: string | null;
  } | null;
};

export function assertNoNormVersionMix(
  references: Array<{ normId: string; normVersionId: string }>,
  comparative = false
) {
  if (comparative) return;
  const versionsByNorm = new Map<string, Set<string>>();
  for (const reference of references) {
    const versions = versionsByNorm.get(reference.normId) ?? new Set<string>();
    versions.add(reference.normVersionId);
    versionsByNorm.set(reference.normId, versions);
  }
  if ([...versionsByNorm.values()].some((versions) => versions.size > 1)) {
    throw new LegalSearchScopeError('VERSION_MIX', 'No se pueden mezclar dos versiones de la misma norma fuera del modo comparativo explícito.');
  }
}

type ScopedVersion = Awaited<ReturnType<typeof loadScopedVersions>>[number];

function extractArticleDesignation(query: string): string | null {
  const match = query.match(/\bart(?:[íi]culo|\.)?\s*(\d+(?:\s*(?:bis|ter|qu[aá]ter|quinquies))?)\b/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function lexicalTerms(query: string): string[] {
  return [...new Set(query
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3)
    .slice(0, 8))];
}

function lexicalScore(text: string, terms: string[]): number {
  const normalized = text.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0) / terms.length;
}

async function loadScopedVersions(db: PrismaExecutor, input: Pick<ControlledLegalSearchInput, 'matter' | 'allowedNormVersionIds' | 'comparative'>) {
  const matter = normalizeLegalMatter(input.matter);
  if (!matter) {
    throw new LegalSearchScopeError('BLOCKED_MATTER', 'La materia solicitada no está habilitada para la búsqueda jurídica controlada.');
  }
  const ids = [...new Set(input.allowedNormVersionIds.filter(Boolean))];
  if (!ids.length) throw new LegalSearchScopeError('INVALID_SCOPE', 'La búsqueda requiere versiones permitidas por una decisión de régimen.');
  const versions = await db.legalNormVersion.findMany({
    where: { id: { in: ids } },
    include: {
      source: true,
      norm: { include: { matters: true } }
    }
  });
  if (versions.length !== ids.length) throw new LegalSearchScopeError('INVALID_SCOPE', 'La lista contiene una versión normativa inexistente.');
  for (const version of versions) {
    const allowedForMatter = version.norm.matters.some((binding) => binding.matter === matter);
    if (!allowedForMatter) {
      throw new LegalSearchScopeError('BLOCKED_MATTER', `La versión ${version.versionKey} no está autorizada para la materia ${matter}.`);
    }
  }
  assertNoNormVersionMix(versions.map((version) => ({ normId: version.normId, normVersionId: version.id })), input.comparative);
  return versions;
}

function mapResult(
  provision: {
    id: string;
    type: string;
    designation: string;
    heading: string | null;
    fullText: string | null;
    normVersion: ScopedVersion;
  },
  score: number,
  match: ControlledLegalSearchResult['match']
): ControlledLegalSearchResult {
  return {
    provisionId: provision.id,
    type: provision.type,
    designation: provision.designation,
    heading: provision.heading,
    fullText: provision.fullText ?? '',
    score,
    match,
    norm: {
      id: provision.normVersion.norm.id,
      canonicalId: provision.normVersion.norm.canonicalId,
      officialName: provision.normVersion.norm.officialName
    },
    version: {
      id: provision.normVersion.id,
      versionKey: provision.normVersion.versionKey,
      status: provision.normVersion.status,
      effectiveFrom: provision.normVersion.effectiveFrom,
      effectiveTo: provision.normVersion.effectiveTo
    },
    source: provision.normVersion.source ? {
      id: provision.normVersion.source.id,
      authority: provision.normVersion.source.authority,
      url: provision.normVersion.source.url,
      trustLevel: provision.normVersion.source.trustLevel,
      capturedAt: provision.normVersion.source.capturedAt,
      contentHash: provision.normVersion.source.contentHash
    } : null
  };
}

function assertQueryVector(vector: number[] | undefined): number[] | null {
  if (!vector) return null;
  if (vector.length !== 1536 || vector.some((value) => !Number.isFinite(value))) {
    throw new LegalSearchScopeError('INVALID_SCOPE', 'El vector de consulta debe tener exactamente 1536 valores numéricos.');
  }
  return vector;
}

async function vectorProvisionIds(db: PrismaExecutor, versionIds: string[], vector: number[], limit: number) {
  const client = db as PrismaClient;
  const literal = `[${vector.join(',')}]`;
  const rows = await client.$queryRaw<Array<{ provisionId: string; score: number }>>(Prisma.sql`
    SELECT p."id" AS "provisionId", 1 - (e."embedding" <=> ${literal}::vector) AS "score"
    FROM "LegalEmbedding" e
    INNER JOIN "LegalProvision" p ON p."id" = e."provisionId"
    WHERE e."indexStatus" = 'INDEXED'
      AND e."embedding" IS NOT NULL
      AND p."normVersionId" IN (${Prisma.join(versionIds)})
    ORDER BY e."embedding" <=> ${literal}::vector
    LIMIT ${limit}
  `);
  return rows;
}

/**
 * Recuperación controlada para el nuevo núcleo. Artículo exacto tiene prioridad;
 * después se suma búsqueda léxica y, si el servidor entrega un vector validado,
 * búsqueda vectorial. No invoca OpenAI ni el RAG heredado.
 */
export async function searchLegalProvisions(db: PrismaExecutor, input: ControlledLegalSearchInput): Promise<ControlledLegalSearchResult[]> {
  const query = input.query.trim();
  if (!query) throw new LegalSearchScopeError('INVALID_SCOPE', 'La consulta jurídica no puede estar vacía.');
  const versions = await loadScopedVersions(db, input);
  const versionIds = versions.map((version) => version.id);
  const limit = Math.max(1, Math.min(20, Math.floor(input.limit ?? 5)));
  const include = {
    normVersion: {
      include: {
        source: true,
        norm: { include: { matters: true } }
      }
    }
  } as const;
  const byId = new Map<string, ControlledLegalSearchResult>();
  const articleDesignation = extractArticleDesignation(query);

  if (articleDesignation) {
    const exact = await db.legalProvision.findMany({
      where: {
        normVersionId: { in: versionIds },
        type: 'ARTICLE',
        designation: { equals: articleDesignation, mode: 'insensitive' },
        fullText: { not: null }
      },
      include,
      take: limit
    });
    for (const provision of exact) byId.set(provision.id, mapResult(provision, 1, 'EXACT_ARTICLE'));
  }

  const terms = lexicalTerms(query);
  const lexical = await db.legalProvision.findMany({
    where: {
      normVersionId: { in: versionIds },
      type: { in: ['ARTICLE', 'FRACTION', 'TRANSITORY'] },
      fullText: { not: null },
      OR: terms.length ? terms.flatMap((term) => [
        { fullText: { contains: term, mode: 'insensitive' as const } },
        { heading: { contains: term, mode: 'insensitive' as const } }
      ]) : [{ fullText: { contains: query, mode: 'insensitive' as const } }]
    },
    include,
    take: limit * 4
  });
  for (const provision of lexical) {
    if (!byId.has(provision.id)) {
      const score = lexicalScore(`${provision.heading ?? ''} ${provision.fullText ?? ''}`, terms);
      byId.set(provision.id, mapResult(provision, score, 'LEXICAL'));
    }
  }

  const vector = assertQueryVector(input.queryVector);
  if (vector) {
    const vectorRows = await vectorProvisionIds(db, versionIds, vector, limit * 2);
    if (vectorRows.length) {
      const vectorProvisions = await db.legalProvision.findMany({
        where: { id: { in: vectorRows.map((row) => row.provisionId) } },
        include
      });
      const provisionById = new Map(vectorProvisions.map((provision) => [provision.id, provision]));
      for (const row of vectorRows) {
        if (byId.has(row.provisionId)) continue;
        const provision = provisionById.get(row.provisionId);
        if (provision) byId.set(provision.id, mapResult(provision, Number(row.score), 'VECTOR'));
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.norm.canonicalId.localeCompare(b.norm.canonicalId) || a.designation.localeCompare(b.designation))
    .slice(0, limit);
}

export async function recordLegalRagCitations(
  db: PrismaExecutor,
  input: { caseId?: string | null; decisionId?: string | null; query: string; response: unknown; results: ControlledLegalSearchResult[] }
) {
  if (!input.results.length) return { count: 0 };
  const queryHash = createHash('sha256').update(input.query).digest('hex');
  const responseText = JSON.stringify(input.response).slice(0, 50_000);
  const responseHash = createHash('sha256').update(responseText).digest('hex');
  const result = await db.legalRagCitation.createMany({
    data: input.results.map((citation) => ({
      caseId: input.caseId ?? null,
      decisionId: input.decisionId ?? null,
      sourceId: citation.source?.id ?? null,
      normId: citation.norm.id,
      normVersionId: citation.version.id,
      provisionId: citation.provisionId,
      queryText: input.query,
      responseText,
      queryHash,
      responseHash
    }))
  });
  return { count: result.count };
}
