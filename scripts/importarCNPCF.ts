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
  const filePath = process.env.SEED_FILE ? path.resolve(process.env.SEED_FILE) : path.join(process.cwd(), 'seed_cnpcf.txt');
  if (!fs.existsSync(filePath)) {
    console.error('No existe seed_cnpcf.txt en la raíz del proyecto');
    process.exit(1);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw.includes('�') || !/Art(í|i)culo\s+\d+/i.test(raw)) {
      // Fallback a latin1 si hay caracteres de reemplazo o no detecta encabezados
      const buf = fs.readFileSync(filePath);
      raw = buf.toString('latin1');
    }
  } catch {
    const buf = fs.readFileSync(filePath);
    raw = buf.toString('latin1');
  }
  raw = raw.replace(/\r\n/g, '\n').trim();
  if (!raw) {
    console.log('El archivo está vacío; nada por importar');
    return;
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`);
  } catch {}
  let state = await prisma.state.findFirst({ where: { name: 'Federación' } });
  if (!state) {
    state = await prisma.state.create({ data: { name: 'Federación', active: true } });
  }
  const stateId = state.id;
  const matter = 'CIVIL';
  const submatter = 'Procesal/Adjetivo';
  const jurisdiccion = 'FEDERAL';
  const parts: string[] = raw.split(/(?=Art(?:í|i)culo\s+\d+)/gi).map((p) => p.trim()).filter((p) => p.length > 0);
  let upserts = 0;
  for (const part of parts) {
    const m = part.match(/^Art(?:í|i)culo\s+(\d+)/i);
    const numero = m ? m[1] : undefined;
    const title = numero
      ? `Artículo ${numero} del Código Nacional de Procedimientos Civiles y Familiares`
      : `Artículo del Código Nacional de Procedimientos Civiles y Familiares`;
    const content = part;
    const d = await prisma.document.upsert({
      where: { stateId_title: { stateId, title } },
      update: { content, matter, submatter, jurisdiccion, active: true },
      create: { title, content, matter, submatter, jurisdiccion, stateId, active: true }
    });
    await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"='CNPCF' WHERE id=$1`, (d as any).id);
    upserts += 1;
  }
  console.log(`CNPCyF procesados: ${parts.length}. Upserts: ${upserts}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
export {};
