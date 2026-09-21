import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; jurisdiccion: string; submatter: string | null; active: boolean }>>(
    `SELECT "id","title","jurisdiccion","submatter","active" FROM "Document" WHERE "jurisdiccion"='FORMATO' ORDER BY "title"`
  );
  console.log('BEGIN_LIST');
  if (!rows || rows.length === 0) {
    console.log('Sin registros en FORMATO.');
  } else {
    rows.forEach(r => {
      console.log(`${r.id} | ${r.title} | ${r.jurisdiccion} | ${r.submatter || ''} | ${r.active ? 'true' : 'false'}`);
    });
  }
  console.log('END_LIST');
}

main()
  .catch(e => {
    console.error('Error:', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
