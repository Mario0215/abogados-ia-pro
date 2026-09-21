/* No comments requested */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const counts = await p.$queryRawUnsafe(
      'SELECT "matter","submatter","jurisdiccion", COUNT(*) AS c, COUNT(embedding) AS ce FROM "Document" GROUP BY 1,2,3 ORDER BY 1,2,3'
    );
    console.log('counts:', counts);
    const zeros = await p.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Document" WHERE embedding IS NULL');
    console.log('null embeddings:', zeros);
    const distJur = await p.$queryRawUnsafe(
      'SELECT DISTINCT jurisdiccion FROM "Document" WHERE "matter"=\'CIVIL\' AND "submatter"=\'Procesal/Adjetivo\''
    );
    console.log('distinct jurisdiccion (Procesal/Adjetivo):', distJur);
    const actives = await p.$queryRawUnsafe(
      'SELECT active, COUNT(*) c FROM "Document" WHERE "matter"=\'CIVIL\' AND "submatter"=\'Procesal/Adjetivo\' GROUP BY 1'
    );
    console.log('active counts (Procesal/Adjetivo):', actives);
    const sampleEstCivilProc = await p.$queryRawUnsafe(
      'SELECT id,title FROM "Document" WHERE "matter"=\'CIVIL\' AND "submatter"=\'Procesal/Adjetivo\' AND "jurisdiccion"=\'ESTATAL\' ORDER BY random() LIMIT 5'
    );
    console.log('sample ESTATAL/CIVIL/Procesal:', sampleEstCivilProc);
    const simil = await p.$queryRawUnsafe(
      `WITH q AS (
         SELECT '[0${','.repeat(1535)}]'::vector AS v
       )
       SELECT id,title, 1 - ("embedding" <=> (SELECT v FROM q)) AS score
       FROM "Document"
       WHERE "embedding" IS NOT NULL AND "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL'
       ORDER BY "embedding" <=> (SELECT v FROM q)
       LIMIT 3`
    );
    console.log('simil placeholder:', simil);
  } catch (e) {
    console.error('diag error:', e);
  } finally {
    await p.$disconnect();
  }
})(); 
