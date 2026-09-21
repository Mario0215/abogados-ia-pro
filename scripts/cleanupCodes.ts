import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        if (!line || line.trim().startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key) process.env[key] = val;
      }
    }
  } catch {}
}

loadEnv();

const prisma = new PrismaClient();

function numFromTitle(title: string): string | null {
  const m = String(title || '').match(/Artículo\s+(\d+)/i);
  return m ? m[1] : null;
}

async function reassignFederalToCNPCF() {
  const sql = `
    UPDATE "Document"
    SET "sourceType"='CNPCF'
    WHERE "jurisdiccion"='FEDERAL'
      AND "matter"='CIVIL'
      AND "submatter"='Procesal/Adjetivo'
      AND COALESCE("sourceType",'')<>'CNPCF'
  `;
  const n = await prisma.$executeRawUnsafe<number>(sql);
  return typeof n === 'number' ? n : 0;
}

async function deduplicateCPCKeepLatest() {
  const rows: Array<{ id: string; title: string; updatedAt: Date }> = await prisma.$queryRawUnsafe(`
    SELECT "id","title","updatedAt" FROM "Document" WHERE "sourceType"='CPC'
  `);
  const latestByNum = new Map<string, { id: string; updatedAt: number }>();
  const toDelete: string[] = [];
  for (const r of rows) {
    const num = numFromTitle(r.title) || 'PRE';
    const ts = new Date(r.updatedAt).getTime();
    const prev = latestByNum.get(num);
    if (!prev || ts > prev.updatedAt) {
      if (prev) toDelete.push(prev.id);
      latestByNum.set(num, { id: r.id, updatedAt: ts });
    } else {
      toDelete.push(r.id);
    }
  }
  if (toDelete.length > 0) {
    await prisma.document.deleteMany({ where: { id: { in: toDelete } } });
  }
  return { deleted: toDelete.length, kept: latestByNum.size };
}

async function uniqueCountBySource(sourceType: 'CC' | 'CPC' | 'CNPCF', stateName?: string) {
  const rows: Array<{ title: string }> = await prisma.$queryRawUnsafe(
    `
    SELECT "title"
    FROM "Document" d
    LEFT JOIN "State" s ON d."stateId"=s."id"
    WHERE d."sourceType"=$1 ${stateName ? `AND s."name"=$2` : ``}
    `,
    sourceType, stateName || undefined
  );
  const set = new Set<string>();
  for (const r of rows) {
    const num = numFromTitle(r.title);
    if (num) set.add(num);
  }
  return set.size;
}

async function main() {
  try {
    const reassigned = await reassignFederalToCNPCF();
    const dedup = await deduplicateCPCKeepLatest();
    const ccCount = await uniqueCountBySource('CC', 'Guanajuato');
    const cpcCount = await uniqueCountBySource('CPC', 'Guanajuato');
    const cnpcfCount = await uniqueCountBySource('CNPCF');
    console.log(JSON.stringify({
      reassignedCNPCF: reassigned,
      deduplicateCPC: dedup,
      finalCounts: {
        CC_GTO: ccCount,
        CPC_GTO: cpcCount,
        CNPCF: cnpcfCount
      }
    }, null, 2));
  } catch (e: any) {
    console.error('Cleanup error:', e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
