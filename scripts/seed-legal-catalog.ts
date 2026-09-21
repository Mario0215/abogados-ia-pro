import { prisma } from '../lib/prisma';
import { ensureInitialLegalNormCatalog } from '../lib/legal/governance';

async function main() {
  const catalog = await ensureInitialLegalNormCatalog(prisma);
  process.stdout.write(`Catálogo jurídico inicial sincronizado: ${catalog.length} normas (sin textos normativos).\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
