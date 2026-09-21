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

async function main() {
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE "CaseKnowledge", "Document" RESTART IDENTITY CASCADE`);
    const docs: Array<{ c: number }> = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Document"`);
    const knowledge: Array<{ c: number }> = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "CaseKnowledge"`);
    console.log(JSON.stringify({ ok: true, counts: { documents: docs?.[0]?.c || 0, caseKnowledge: knowledge?.[0]?.c || 0 } }));
  } catch (e: any) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
