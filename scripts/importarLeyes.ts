const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split(/\r?\n/).forEach((line: string) => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+)\s*$/);
    if (m) {
      const key = m[1];
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  });
}
const { prisma } = require('../lib/prisma');
async function main() {
  const filePath = process.env.SEED_FILE ? path.resolve(process.env.SEED_FILE) : path.join(process.cwd(), 'seed_leyes_gto.txt');
  if (!fs.existsSync(filePath)) {
    console.error('No existe seed_leyes_gto.txt en la raíz del proyecto');
    process.exit(1);
  }
  const raw: string = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    console.log('El archivo está vacío; nada por importar');
    return;
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`);
  } catch {}
  const nulls: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "sourceType" IS NULL`);
  const cpcBad: any = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM "Document"
    WHERE "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL' AND COALESCE("sourceType",'')<>'CPC'
  `);
  if ((nulls?.[0]?.c || 0) > 0 || (cpcBad?.[0]?.c || 0) > 0) {
    const fix: any = await prisma.$executeRawUnsafe(`
      UPDATE "Document"
      SET "sourceType"='CPC'
      WHERE "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL' AND COALESCE("sourceType",'')<>'CPC'
    `);
    const nulls2: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "sourceType" IS NULL`);
    const cpcBad2: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM "Document"
      WHERE "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL' AND COALESCE("sourceType",'')<>'CPC'
    `);
    if ((nulls2?.[0]?.c || 0) > 0 || (cpcBad2?.[0]?.c || 0) > 0) {
      console.error('Validación previa falló: hay documentos sin sourceType o CPC mal etiquetado.');
      process.exit(1);
    } else {
      console.log(`Autofix aplicado a CPC: ${typeof fix === 'number' ? fix : 0} filas.`);
    }
  }
  const parts: string[] = raw.split(/(?=Artículo\s+\d+)/g).map((p) => p.trim()).filter((p) => p.length > 0);
  let state = await prisma.state.findFirst({ where: { name: 'Guanajuato' } });
  if (!state) {
    state = await prisma.state.create({ data: { name: 'Guanajuato', active: true } });
  }
  const stateId = state.id;
  const matter = 'CIVIL';
  const submatter = 'Sustantivo';
  const jurisdiccion = 'ESTATAL';
  let upserts = 0;
  for (const part of parts) {
    const m = part.match(/^Artículo\s+(\d+)/);
    const numero = m ? m[1] : undefined;
    const title = numero ? `Artículo ${numero} del Código Civil para el Estado de Guanajuato` : `Artículo del Código Civil para el Estado de Guanajuato`;
    const content = part;
    const d = await prisma.document.upsert({
      where: { stateId_title: { stateId, title } },
      update: { content, matter, submatter, jurisdiccion, active: true },
      create: { title, content, matter, submatter, jurisdiccion, stateId, active: true }
    });
    await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"='CC' WHERE id=$1`, (d as any).id);
    upserts += 1;
  }
  console.log(`Procesados: ${parts.length}. Upserts: ${upserts}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
export {};
