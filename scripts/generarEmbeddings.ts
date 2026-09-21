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
  } catch {
    // silencioso
  }
}

const prisma = new PrismaClient();

async function getBatch(limit: number) {
  const st = (process.env.SOURCE_TYPE || '').trim();
  const filter = st ? `AND "sourceType"='${st.replace(/'/g, "''")}'` : `AND "sourceType" IS NOT NULL`;
  const rows = await prisma.$queryRawUnsafe<{ id: string; content: string }[]>(
    `SELECT "id","content" FROM "Document" WHERE "content" IS NOT NULL AND "embedding" IS NULL ${filter} ORDER BY "id" LIMIT ${limit}`
  );
  return rows;
}

async function embedText(apiKey: string, input: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const vec: number[] = data?.data?.[0]?.embedding || [];
  if (!Array.isArray(vec) || vec.length === 0) throw new Error('Embedding vacío');
  return vec;
}

async function updateEmbedding(id: string, vec: number[]) {
  const vecString = `[${vec.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "Document" SET "embedding" = '${vecString}'::vector WHERE "id" = '${id}'`
  );
}

async function main() {
  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY no está configurada');
    process.exit(1);
  }
  const limit = 50;
  let total = 0;
  let updated = 0;
  const st = (process.env.SOURCE_TYPE || '').trim();
  const filter = st ? `AND "sourceType"='${st.replace(/'/g, "''")}'` : `AND "sourceType" IS NOT NULL`;
  const totalToProcess = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*)::int AS c FROM "Document" WHERE "content" IS NOT NULL AND "embedding" IS NULL ${filter}`
  );
  const N = totalToProcess?.[0]?.c || 0;
  while (true) {
    const batch = await getBatch(limit);
    if (!batch.length) break;
    total += batch.length;
    for (const row of batch) {
      try {
        const vec = await embedText(apiKey, String(row.content));
        await updateEmbedding(row.id, vec);
        updated += 1;
      } catch (e: any) {
        console.error(`Error con Document ${row.id}: ${e?.message || 'desconocido'}`);
      }
    }
  }
  console.log(`Procesados: ${total}. Embeddings actualizados: ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
