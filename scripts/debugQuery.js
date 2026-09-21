const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const num = process.argv[2] || '287';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id","title","jurisdiccion","submatter","sourceType"
     FROM "Document"
     WHERE "matter"=$1
       AND "sourceType"='CC'
       AND ("title" = $2 OR "title" LIKE $3)
     ORDER BY "title"
     LIMIT 5`,
    'CIVIL',
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
