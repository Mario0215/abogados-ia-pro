import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const count = await prisma.$executeRawUnsafe(
    `DELETE FROM "Document" WHERE "title" = $1 AND "jurisdiccion" = $2`,
    'Plantilla 1',
    'FORMATO'
  );
  console.log(String(count));
}

main()
  .catch(e => {
    console.error('Error:', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

