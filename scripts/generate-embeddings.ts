import 'dotenv/config';
import { prisma } from '../lib/prisma';

type DocRow = { id: string; title: string; content: string | null; sourceType: string | null };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getPendingCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT COUNT(*)::text AS count FROM "Document" WHERE "embedding" IS NULL`
  );
  return Number(rows?.[0]?.count || 0);
}

async function getPendingBatch(limit = 20): Promise<DocRow[]> {
  const rows = await prisma.$queryRawUnsafe<Array<DocRow>>(
    `SELECT "id","title","content","sourceType" FROM "Document" WHERE "embedding" IS NULL ORDER BY "createdAt" ASC LIMIT $1`,
    limit
  );
  return rows || [];
}

function truncateInput(title: string, content: string | null, max = 8000): string {
  const raw = `${title || ''} ${content || ''}`;
  return raw.length > max ? raw.slice(0, max) : raw;
}

async function embed(text: string): Promise<number[]> {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (process.env.CLAVE_API_DE_OPENAI as string) ||
    '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada');
  }
  const body = {
    model: 'text-embedding-3-small',
    input: text
  };
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status} ${errText}`);
  }
  const data: any = await res.json();
  const vec: number[] = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error('Embedding vacío');
  }
  return vec;
}

function toVectorLiteral(vec: number[]): string {
  // pgvector acepta el literal: [v1, v2, v3, ...]
  return `[${vec.map((v) => (Number.isFinite(v) ? v : 0)).join(', ')}]`;
}

async function saveEmbedding(id: string, vec: number[]) {
  const literal = toVectorLiteral(vec);
  await prisma.$executeRawUnsafe(
    `UPDATE "Document" SET "embedding" = $1::vector WHERE "id" = $2`,
    literal,
    id
  );
}

async function main() {
  const total = await getPendingCount();
  if (total === 0) {
    console.log('No hay documentos pendientes de embedding.');
    return;
  }
  console.log(`Pendientes: ${total} documentos sin embedding`);
  let processed = 0;
  const bySource: Record<string, number> = {};

  while (processed < total) {
    const batch = await getPendingBatch(20);
    if (batch.length === 0) break;
    for (const doc of batch) {
      try {
        const input = truncateInput(doc.title, doc.content, 8000);
        const vec = await embed(input);
        await saveEmbedding(doc.id, vec);
        processed++;
        const key = (doc.sourceType || '—').toUpperCase();
        bySource[key] = (bySource[key] || 0) + 1;
        console.log(`Procesado ${processed} de ${total} · ${doc.title}`);
      } catch (e: any) {
        console.error(`Error con "${doc.title}": ${e?.message || e}`);
      }
    }
    await sleep(500); // pausa entre lotes
  }

  console.log('\nResumen por sourceType (embeddings generados en esta corrida):');
  Object.entries(bySource).forEach(([key, count]) => {
    console.log(`- ${key}: ${count}`);
  });
}

main()
  .catch((e) => {
    console.error('Fallo general:', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

