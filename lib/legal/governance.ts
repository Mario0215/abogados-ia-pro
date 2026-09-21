import { createHash, randomUUID } from 'crypto';
import {
  LegalEmbeddingIndexStatus,
  LegalNormVersionStatus,
  LegalSourceExtractionStatus,
  LegalSourceStatus,
  LegalSourceTrustLevel,
  Prisma,
  type PrismaClient
} from '@prisma/client';
import { INITIAL_LEGAL_NORM_CATALOG, type LegalNormVersionStatusCode } from './constants';
import { previewLegalStructure } from './structure-preview';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export type CreateLegalSourceInput = {
  authority: string;
  url: string;
  trustLevel: LegalSourceTrustLevel;
  capturedAt?: Date;
  contentHash?: string | null;
  originFile?: string | null;
  notes?: string | null;
};

export function legalSourceFingerprint(input: Pick<CreateLegalSourceInput, 'authority' | 'url' | 'contentHash' | 'originFile'>): string {
  return createHash('sha256')
    .update([input.authority.trim(), input.url.trim(), input.contentHash?.trim() ?? '', input.originFile?.trim() ?? ''].join('|'))
    .digest('hex');
}

export async function upsertLegalSource(db: PrismaExecutor, input: CreateLegalSourceInput) {
  const fingerprint = legalSourceFingerprint(input);
  return db.legalSource.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      authority: input.authority.trim(),
      url: input.url.trim(),
      trustLevel: input.trustLevel,
      capturedAt: input.capturedAt ?? new Date(),
      contentHash: input.contentHash?.trim() || null,
      originFile: input.originFile?.trim() || null,
      notes: input.notes?.trim() || null,
      status: LegalSourceStatus.DRAFT
    },
    update: {
      // Una reimportación idéntica no sobrescribe la fecha ni rebaja la confianza.
      notes: input.notes?.trim() || undefined
    }
  });
}

/** Inserta sólo metadatos oficiales conocidos; no descarga ni almacena texto legal. */
export async function ensureInitialLegalNormCatalog(db: PrismaExecutor) {
  const catalog = [] as Array<{ canonicalId: string; id: string }>;
  for (const entry of INITIAL_LEGAL_NORM_CATALOG) {
    const norm = await db.legalNorm.upsert({
      where: { canonicalId: entry.canonicalId },
      create: {
        canonicalId: entry.canonicalId,
        officialName: entry.officialName,
        matter: entry.primaryMatter,
        scope: entry.scope,
        issuingAuthority: entry.issuingAuthority,
        active: true
      },
      update: {
        officialName: entry.officialName,
        matter: entry.primaryMatter,
        scope: entry.scope,
        issuingAuthority: entry.issuingAuthority,
        active: true
      }
    });
    await db.legalNormMatter.createMany({
      data: entry.matters.map((matter) => ({ normId: norm.id, matter })),
      skipDuplicates: true
    });
    catalog.push({ canonicalId: norm.canonicalId, id: norm.id });
  }
  return catalog;
}

export type CreateDraftLegalNormVersionInput = {
  normId: string;
  versionKey: string;
  publicationDate?: Date | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  sourceId?: string | null;
  contentHash?: string | null;
  previousVersionId?: string | null;
  notes?: string | null;
};

/**
 * Importar la misma norma/versionKey es idempotente. Una versión publicada o
 * vigente no se modifica aquí: cualquier corrección exige una versión nueva.
 */
export async function createDraftLegalNormVersion(db: PrismaExecutor, input: CreateDraftLegalNormVersionInput) {
  const existing = await db.legalNormVersion.findUnique({
    where: { normId_versionKey: { normId: input.normId, versionKey: input.versionKey.trim() } }
  });
  if (existing) {
    if (existing.status !== LegalNormVersionStatus.DRAFT && existing.status !== LegalNormVersionStatus.UNDER_REVIEW) {
      return { version: existing, created: false, immutable: true };
    }
    const version = await db.legalNormVersion.update({
      where: { id: existing.id },
      data: {
        publicationDate: input.publicationDate ?? existing.publicationDate,
        effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom,
        effectiveTo: input.effectiveTo ?? existing.effectiveTo,
        sourceId: input.sourceId ?? existing.sourceId,
        contentHash: input.contentHash ?? existing.contentHash,
        previousVersionId: input.previousVersionId ?? existing.previousVersionId,
        notes: input.notes ?? existing.notes
      }
    });
    return { version, created: false, immutable: false };
  }
  const version = await db.legalNormVersion.create({
    data: {
      normId: input.normId,
      versionKey: input.versionKey.trim(),
      publicationDate: input.publicationDate ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      sourceId: input.sourceId ?? null,
      contentHash: input.contentHash ?? null,
      previousVersionId: input.previousVersionId ?? null,
      notes: input.notes ?? null,
      status: LegalNormVersionStatus.DRAFT
    }
  });
  return { version, created: true, immutable: false };
}

export type CreateDraftFromLegalSourceInput = Omit<CreateDraftLegalNormVersionInput, 'sourceId' | 'contentHash'> & {
  sourceId: string;
};

/**
 * Crea una versión sólo desde el texto extraído del PDF que ya quedó archivado.
 * La fuente se encuentra ligada a una norma concreta para impedir reutilizarla
 * por error en otra materia, norma o versión.
 */
export async function createDraftLegalNormVersionFromSource(
  db: PrismaExecutor,
  input: CreateDraftFromLegalSourceInput
) {
  const source = await db.legalSource.findUnique({
    where: { id: input.sourceId },
    select: {
      id: true,
      targetNormId: true,
      originalFileName: true,
      originalSha256: true,
      originalStoragePath: true,
      originalFileData: true,
      extractionStatus: true,
      extractedText: true,
      extractedTextHash: true
    }
  });
  if (!source) throw new Error('Fuente oficial no encontrada.');
  if (source.targetNormId !== input.normId) {
    throw new Error('La fuente cargada pertenece a otra norma y no puede mezclarse con esta versión.');
  }
  if (!source.originalFileName || !source.originalSha256 || (!source.originalStoragePath && !source.originalFileData)) {
    throw new Error('La fuente no conserva un archivo original verificable.');
  }
  if (source.extractionStatus !== LegalSourceExtractionStatus.EXTRACTED || !source.extractedText || !source.extractedTextHash) {
    throw new Error('La fuente aún no tiene texto extraído verificable; requiere OCR o revisión antes de crear un borrador.');
  }

  const existing = await db.legalNormVersion.findUnique({
    where: { normId_versionKey: { normId: input.normId, versionKey: input.versionKey.trim() } },
    include: { _count: { select: { provisions: true } } }
  });
  if (existing && existing.status !== LegalNormVersionStatus.DRAFT) {
    throw new Error('La versión ya pasó de borrador; crea una nueva clave de versión para preservar su historial.');
  }
  if (existing && existing.sourceId && existing.sourceId !== source.id) {
    throw new Error('La clave de versión ya está ligada a otra fuente y no puede sustituirse.');
  }
  if (existing && existing._count.provisions > 0 && existing.sourceId !== source.id) {
    throw new Error('La clave de versión ya tiene estructura. Crea una nueva versión en vez de reemplazar su procedencia.');
  }

  const preview = previewLegalStructure(source.extractedText);
  if (!preview.provisions.some((provision) => provision.type === 'ARTICLE')) {
    throw new Error('No se detectaron artículos en el texto extraído. Revisa la previsualización antes de crear el borrador.');
  }
  const draft = await createDraftLegalNormVersion(db, {
    ...input,
    sourceId: source.id,
    contentHash: source.extractedTextHash
  });
  if (draft.immutable) throw new Error('La versión ya es inmutable. Crea una nueva clave de versión.');
  const structure = await replaceDraftLegalProvisionStructure(db, draft.version.id, source.extractedText);
  return { ...draft, preview, structure };
}

export function deriveLegalNormVersionStatus(
  input: Pick<CreateDraftLegalNormVersionInput, 'effectiveFrom' | 'effectiveTo'>,
  asOf = new Date()
): LegalNormVersionStatusCode {
  if (input.effectiveTo && input.effectiveTo.getTime() < asOf.getTime()) return 'HISTORICAL';
  if (input.effectiveFrom && input.effectiveFrom.getTime() > asOf.getTime()) return 'FUTURE';
  return 'CURRENT';
}

export async function publishLegalNormVersion(
  db: PrismaExecutor,
  versionId: string,
  options: { asOf?: Date; status?: 'PUBLISHED' | 'CURRENT' | 'FUTURE' } = {}
) {
  const version = await db.legalNormVersion.findUnique({
    where: { id: versionId },
    include: { source: true, _count: { select: { provisions: true } } }
  });
  if (!version) throw new Error('Versión normativa no encontrada.');
  if (version.status === LegalNormVersionStatus.REPEALED || version.status === LegalNormVersionStatus.HISTORICAL) {
    throw new Error('No se puede republicar una versión retirada o histórica. Crea una nueva versión.');
  }
  if (version.status !== LegalNormVersionStatus.UNDER_REVIEW) {
    throw new Error('La versión debe pasar por revisión administrativa antes de publicarse.');
  }
  if (!version.contentHash) throw new Error('No se puede publicar una versión sin hash de contenido.');
  if (!version.source || version.source.status !== LegalSourceStatus.ACTIVE) {
    throw new Error('La versión requiere una fuente activa antes de publicarse.');
  }
  if (version._count.provisions === 0) {
    throw new Error('La versión requiere una estructura jurídica revisable antes de publicarse.');
  }
  if (version.source.originalFileName && (
    !version.source.originalSha256
    || version.source.extractionStatus !== LegalSourceExtractionStatus.EXTRACTED
    || !version.source.extractedTextHash
  )) {
    throw new Error('La fuente PDF no tiene archivo y extracción verificables para publicación.');
  }
  if (version.source.trustLevel === LegalSourceTrustLevel.CURATED_INTERNAL) {
    throw new Error('Una fuente interna curada no puede ser la única fuente de una versión publicada.');
  }
  const derived = deriveLegalNormVersionStatus(version, options.asOf ?? new Date());
  if (derived === 'HISTORICAL') {
    throw new Error('La fecha de vigencia ya concluyó; no se puede publicar una versión histórica.');
  }
  const targetStatus: 'PUBLISHED' | 'CURRENT' | 'FUTURE' = options.status === 'PUBLISHED'
    ? LegalNormVersionStatus.PUBLISHED
    : derived === 'FUTURE'
      ? LegalNormVersionStatus.FUTURE
      : LegalNormVersionStatus.CURRENT;
  if (options.status === 'FUTURE' && derived !== 'FUTURE') {
    throw new Error('La fecha de vigencia no permite publicar esta versión como FUTURE.');
  }

  const client = db as PrismaClient;
  return client.$transaction(async (tx) => {
    if (targetStatus === LegalNormVersionStatus.CURRENT) {
      await tx.legalNormVersion.updateMany({
        where: { normId: version.normId, id: { not: version.id }, status: LegalNormVersionStatus.CURRENT },
        data: { status: LegalNormVersionStatus.HISTORICAL }
      });
    }
    return tx.legalNormVersion.update({
      where: { id: version.id },
      data: { status: targetStatus }
    });
  });
}

export async function retireLegalNormVersion(
  db: PrismaExecutor,
  versionId: string,
  options: { reason: string; retiredAt?: Date; status?: 'REPEALED' | 'HISTORICAL' }
) {
  if (!options.reason.trim()) throw new Error('El retiro no destructivo requiere motivo.');
  const version = await db.legalNormVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error('Versión normativa no encontrada.');
  return db.legalNormVersion.update({
    where: { id: versionId },
    data: {
      status: options.status === 'HISTORICAL' ? LegalNormVersionStatus.HISTORICAL : LegalNormVersionStatus.REPEALED,
      effectiveTo: options.retiredAt ?? new Date(),
      notes: [version.notes, `Retiro: ${options.reason.trim()}`].filter(Boolean).join('\n')
    }
  });
}

/** Persiste una estructura sólo si la versión sigue en borrador/revisión. */
export async function replaceDraftLegalProvisionStructure(db: PrismaExecutor, versionId: string, rawText: string) {
  const version = await db.legalNormVersion.findUnique({
    where: { id: versionId },
    include: { source: { select: { extractedTextHash: true } } }
  });
  if (!version) throw new Error('Versión normativa no encontrada.');
  if (version.status !== LegalNormVersionStatus.DRAFT && version.status !== LegalNormVersionStatus.UNDER_REVIEW) {
    throw new Error('La estructura publicada es inmutable. Crea una versión nueva para corregirla.');
  }
  if (version.source?.extractedTextHash && createHash('sha256').update(rawText).digest('hex') !== version.source.extractedTextHash) {
    throw new Error('La estructura de una fuente PDF debe derivarse exactamente de su texto extraído; no se puede mezclar texto o versiones.');
  }
  const preview = previewLegalStructure(rawText);
  if (!preview.provisions.length) throw new Error('No se detectó estructura normativa para importar.');

  const client = db as PrismaClient;
  // Los IDs se generan antes del insert masivo para conservar los vínculos
  // parentId sin convertir una norma extensa en miles de viajes a Neon.
  const idByPreviewId = new Map<string, string>();
  for (const provision of preview.provisions) idByPreviewId.set(provision.temporaryId, randomUUID());
  const provisionRows = preview.provisions.map((provision) => ({
    id: idByPreviewId.get(provision.temporaryId) as string,
    normVersionId: versionId,
    parentId: provision.parentTemporaryId ? idByPreviewId.get(provision.parentTemporaryId) ?? null : null,
    type: provision.type,
    designation: provision.designation,
    sortOrder: provision.sortOrder,
    structurePath: provision.structurePath,
    heading: provision.heading,
    fullText: provision.fullText || null,
    contentHash: provision.contentHash
  }));

  return client.$transaction(async (tx) => {
    await tx.legalEmbedding.deleteMany({ where: { provision: { normVersionId: versionId } } });
    await tx.legalProvision.deleteMany({ where: { normVersionId: versionId } });
    const batchSize = 400;
    for (let start = 0; start < provisionRows.length; start += batchSize) {
      await tx.legalProvision.createMany({ data: provisionRows.slice(start, start + batchSize) });
    }
    const updatedVersion = await tx.legalNormVersion.update({
      where: { id: versionId },
      data: { contentHash: preview.sourceHash }
    });
    return { preview, version: updatedVersion };
  }, {
    // Un PDF oficial puede contener miles de disposiciones. La transacción
    // sigue siendo atómica, pero no debe expirar con el valor interactivo
    // predeterminado mientras se insertan los lotes en Neon.
    maxWait: 10_000,
    timeout: 60_000
  });
}

/** Marca todos los artículos/fracciones con texto para indexación; no llama a IA. */
export async function queueLegalVersionReindex(
  db: PrismaExecutor,
  versionId: string,
  model = 'text-embedding-3-small'
) {
  const version = await db.legalNormVersion.findUnique({ where: { id: versionId }, select: { status: true } });
  if (!version) throw new Error('Versión normativa no encontrada.');
  if (
    version.status !== LegalNormVersionStatus.PUBLISHED
    && version.status !== LegalNormVersionStatus.CURRENT
    && version.status !== LegalNormVersionStatus.FUTURE
  ) {
    throw new Error('Sólo una versión publicada puede enviarse a indexación RAG.');
  }
  const provisions = await db.legalProvision.findMany({
    where: {
      normVersionId: versionId,
      fullText: { not: null },
      type: { in: ['ARTICLE', 'FRACTION', 'TRANSITORY'] }
    },
    select: { id: true, contentHash: true, fullText: true }
  });
  let queued = 0;
  for (const provision of provisions) {
    const contentHash = provision.contentHash || createHash('sha256').update(provision.fullText || '').digest('hex');
    await db.legalEmbedding.upsert({
      where: { provisionId_model_contentHash: { provisionId: provision.id, model, contentHash } },
      create: { provisionId: provision.id, model, contentHash, indexStatus: LegalEmbeddingIndexStatus.PENDING },
      update: { indexStatus: LegalEmbeddingIndexStatus.PENDING, lastError: null }
    });
    queued += 1;
  }
  return { queued };
}
