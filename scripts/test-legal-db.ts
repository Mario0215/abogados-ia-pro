import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';
import { LegalSourceStatus, PrismaClient } from '@prisma/client';
import {
  LegalSearchScopeError,
  createDraftLegalNormVersion,
  ensureInitialLegalNormCatalog,
  searchLegalProvisions,
  upsertLegalSource
} from '../lib/legal';

// Prisma CLI loads .env automatically; standalone TypeScript scripts do not.
// Preserve explicitly supplied environment variables (for CI) while supporting local execution.
loadEnv({ path: '.env' });

const prisma = new PrismaClient();
const suffix = `legal-core-test-${Date.now()}`;

async function main() {
  await ensureInitialLegalNormCatalog(prisma);
  const [cc, lft] = await Promise.all([
    prisma.legalNorm.findUniqueOrThrow({ where: { canonicalId: 'CC_GTO' } }),
    prisma.legalNorm.findUniqueOrThrow({ where: { canonicalId: 'LFT' } })
  ]);
  const source = await upsertLegalSource(prisma, {
    authority: 'Fuente de prueba local',
    url: `https://example.invalid/${suffix}`,
    trustLevel: 'PRIMARY_OFFICIAL',
    contentHash: suffix,
    originFile: `${suffix}.txt`
  });
  await prisma.legalSource.update({ where: { id: source.id }, data: { status: LegalSourceStatus.ACTIVE } });

  const firstImport = await createDraftLegalNormVersion(prisma, {
    normId: cc.id,
    versionKey: suffix,
    sourceId: source.id,
    contentHash: suffix
  });
  const secondImport = await createDraftLegalNormVersion(prisma, {
    normId: cc.id,
    versionKey: suffix,
    sourceId: source.id,
    contentHash: suffix
  });
  assert.equal(firstImport.version.id, secondImport.version.id);
  assert.equal(secondImport.created, false);
  const duplicateCount = await prisma.legalNormVersion.count({ where: { normId: cc.id, versionKey: suffix } });
  assert.equal(duplicateCount, 1);

  const lftVersion = await createDraftLegalNormVersion(prisma, {
    normId: lft.id,
    versionKey: suffix,
    sourceId: source.id,
    contentHash: `${suffix}-lft`
  });
  const anotherCc = await createDraftLegalNormVersion(prisma, {
    normId: cc.id,
    versionKey: `${suffix}-second`,
    sourceId: source.id,
    contentHash: `${suffix}-second`
  });
  await prisma.legalProvision.create({
    data: {
      normVersionId: firstImport.version.id,
      type: 'ARTICLE',
      designation: '10',
      sortOrder: 1,
      structurePath: 'ARTICLE:10',
      fullText: 'Artículo 10. Texto de prueba civil y familiar.',
      contentHash: `${suffix}-art-10`
    }
  });

  const exact = await searchLegalProvisions(prisma, {
    matter: 'FAMILIAR',
    allowedNormVersionIds: [firstImport.version.id],
    query: 'Artículo 10'
  });
  assert.equal(exact.length, 1);
  assert.equal(exact[0].match, 'EXACT_ARTICLE');
  assert.equal(exact[0].norm.canonicalId, 'CC_GTO');

  await assert.rejects(
    () => searchLegalProvisions(prisma, {
      matter: 'FAMILIAR',
      allowedNormVersionIds: [firstImport.version.id, lftVersion.version.id],
      query: 'Artículo 10'
    }),
    (error: unknown) => error instanceof LegalSearchScopeError && error.code === 'BLOCKED_MATTER'
  );
  await assert.rejects(
    () => searchLegalProvisions(prisma, {
      matter: 'CIVIL',
      allowedNormVersionIds: [firstImport.version.id, anotherCc.version.id],
      query: 'Artículo 10'
    }),
    (error: unknown) => error instanceof LegalSearchScopeError && error.code === 'VERSION_MIX'
  );
  await assert.rejects(
    () => searchLegalProvisions(prisma, {
      matter: 'PENAL',
      allowedNormVersionIds: [firstImport.version.id],
      query: 'Artículo 10'
    }),
    (error: unknown) => error instanceof LegalSearchScopeError && error.code === 'BLOCKED_MATTER'
  );

  await prisma.legalProvision.deleteMany({ where: { normVersionId: { in: [firstImport.version.id, lftVersion.version.id, anotherCc.version.id] } } });
  await prisma.legalNormVersion.deleteMany({ where: { id: { in: [firstImport.version.id, lftVersion.version.id, anotherCc.version.id] } } });
  await prisma.legalSource.delete({ where: { id: source.id } });
  process.stdout.write('✓ Reimportación idempotente, alcance de materia y no mezcla de versiones verificados en PostgreSQL local.\n');
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
