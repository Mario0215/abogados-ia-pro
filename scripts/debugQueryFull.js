const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const num = process.argv[2] || '287';
  const submatter = process.argv[3] || 'Sustantivo';
  const jurisdiccion = process.argv[4] || 'ESTATAL';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id","title","jurisdiccion","submatter","sourceType"
     FROM "Document"
     WHERE "matter" = $1
       AND "submatter" = $2
       AND "jurisdiccion" = $3
       AND "sourceType" = 'CC'
       AND "active" = true
       AND ("title" = $4 OR "title" LIKE $5)
     ORDER BY "title"
     LIMIT 5`,
    'CIVIL',
    submatter,
    jurisdiccion,
    `Artículo ${num}`,
    `Artículo ${num} %`
  );
  console.log(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
