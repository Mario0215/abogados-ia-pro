const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

function loadEnv() {
  try {
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(path.dirname(require.main.filename), '..', '.env'),
      path.join(process.cwd(), '.env.local')
    ];
    const envPath = candidates.find((p) => fs.existsSync(p));
    if (!envPath) return;
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
  } catch {}
}

loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getBatch(limit) {
  const st = process.env.SOURCE_TYPE && typeof process.env.SOURCE_TYPE === 'string' ? process.env.SOURCE_TYPE.trim() : '';
  const filter = st ? `AND "sourceType"='${st.replace(/'/g, "''")}'` : `AND "sourceType" IS NOT NULL`;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id","content" FROM "Document" WHERE "content" IS NOT NULL AND "embedding" IS NULL ${filter} ORDER BY "id" LIMIT ${limit}`
  );
  return rows;
}

async function embedText(apiKey, input) {
  const attempt = async () => {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI ${res.status} ${text}`);
    }
    const data = await res.json();
    const vec = (data && data.data && data.data[0] && data.data[0].embedding) || [];
    if (!Array.isArray(vec) || vec.length === 0) throw new Error('Embedding vacío');
    return vec;
  };
  let tries = 0;
  let delay = 500;
  while (true) {
    try {
      return await attempt();
    } catch (e) {
      tries += 1;
      if (tries >= 3) throw e;
      await new Promise((r) => setTimeout(r, delay));
      delay = delay * 3;
    }
  }
}

async function updateEmbedding(id, vec) {
  const vecString = `[${vec.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "Document" SET "embedding" = '${vecString}'::vector WHERE "id" = '${id}'`
  );
}

async function main() {
  let apiKey = process.env.OPENAI_API_KEY || process.env.CLAVE_API_DE_OPENAI;
  if (!apiKey) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
      const m = raw.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        apiKey = v;
      }
    } catch {}
  }
  if (!apiKey) {
    console.error('OPENAI_API_KEY no está configurada');
    process.exit(1);
  }
  const limit = 50;
  let total = 0;
  let updated = 0;
  const st = process.env.SOURCE_TYPE && typeof process.env.SOURCE_TYPE === 'string' ? process.env.SOURCE_TYPE.trim() : '';
  const filter = st ? `AND "sourceType"='${st.replace(/'/g, "''")}'` : `AND "sourceType" IS NOT NULL`;
  const totalToProcess = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "content" IS NOT NULL AND "embedding" IS NULL ${filter}`);
  const N = Array.isArray(totalToProcess) && totalToProcess[0] && totalToProcess[0].c ? Number(totalToProcess[0].c) : 0;
  let i = 0;
  while (true) {
    const batch = await getBatch(limit);
    if (!batch.length) break;
    total += batch.length;
    for (const row of batch) {
      try {
        i += 1;
        console.log(`Procesando ${i} de ${N}: ${row.id}`);
        const vec = await embedText(apiKey, String(row.content));
        await updateEmbedding(row.id, vec);
        updated += 1;
      } catch (e) {
        console.error(`Error con Document ${row.id}: ${e && e.message ? e.message : 'desconocido'}`);
      }
    }
  }
  console.log(`Procesados: ${total}. Embeddings actualizados: ${updated}.`);
  const cnt = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "embedding" IS NOT NULL ${st ? `AND "sourceType"='${st.replace(/'/g, "''")}'` : ''}`);
  const done = Array.isArray(cnt) && cnt[0] && cnt[0].c ? Number(cnt[0].c) : 0;
  console.log(`Embeddings en BD${st ? ` (${st})` : ''}: ${done}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
