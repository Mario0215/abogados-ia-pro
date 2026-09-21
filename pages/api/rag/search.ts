import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

let vectorReadyChecked = false;
let metadataReadyChecked = false;
async function ensureVectorReady() {
  if (vectorReadyChecked) return;
  try {
    const ext = await prisma.$queryRawUnsafe<{ extname: string }[]>(`SELECT extname FROM pg_extension WHERE extname='vector'`);
    if (!ext || ext.length === 0) throw new Error('pgvector no habilitado');
    const fmt = await prisma.$queryRawUnsafe<{ fmt: string }[]>(
      `SELECT format_type(a.atttypid, a.atttypmod) AS fmt
       FROM pg_attribute a
       JOIN pg_class c ON c.oid=a.attrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='Document' AND a.attname='embedding'`
    );
    const ok = Array.isArray(fmt) && fmt[0]?.fmt?.toLowerCase() === 'vector(1536)';
    if (!ok) throw new Error('Columna embedding no es vector(1536)');
    vectorReadyChecked = true;
  } catch (e) {
    process.stderr.write(`Vector readiness check failed: ${String((e as any)?.message || e)}\n`);
    throw e;
  }
}

async function ensureMetadataReady() {
  if (metadataReadyChecked) return;
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Document" SET "sourceType"='CPC'
      WHERE "sourceType" IS NULL AND "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL'
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Document" SET "sourceType"='CC'
      WHERE "sourceType" IS NULL AND "matter"='CIVIL' AND "jurisdiccion"='GTO'
    `);
    metadataReadyChecked = true;
  } catch (e) {
    process.stderr.write(`Metadata readiness check failed: ${String((e as any)?.message || e)}\n`);
    metadataReadyChecked = true;
  }
}

async function embedQuery(apiKey: string, input: string): Promise<number[]> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: any = null;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input })
      });
      if (!res.ok) {
        const text = await res.text();
        if ([429, 500, 502, 503, 504].includes(res.status)) {
          throw new Error(`OpenAI ${res.status} ${text}`);
        }
        throw new Error(`OpenAI ${res.status}`);
      }
      const data = await res.json();
      const vec: number[] = data?.data?.[0]?.embedding || [];
      if (!Array.isArray(vec) || vec.length === 0) throw new Error('Embedding vacío');
      return vec;
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  process.stderr.write(`embedQuery failed: ${String(lastError?.message || lastError)}\n`);
  throw lastError;
}

function detectSubmatter(query: string): 'divorcio' | 'matrimonio' | 'filiacion' | 'tutela' | null {
  const q = query.toLowerCase();
  const sets: Record<string, string[]> = {
    divorcio: [
      'divorcio',
      'incausado',
      'separación',
      'separacion',
      'disolución',
      'disolucion',
      'causas de divorcio',
      'terminación del matrimonio',
      'terminacion del matrimonio'
    ],
    matrimonio: [
      'matrimonio',
      'nupcias',
      'esponsales',
      'conyugal',
      'requisitos para contraer matrimonio',
      'impedimentos',
      'capacidad matrimonial'
    ],
    filiacion: [
      'filiación',
      'filiacion',
      'paternidad',
      'maternidad',
      'impugnación de filiación',
      'impugnacion de filiacion',
      'reconocimiento de hijo',
      'reconocer la paternidad'
    ],
    tutela: [
      'tutela',
      'tutor',
      'curatela',
      'interdicción',
      'interdiccion',
      'incapaz',
      'incapacidad',
      'sujeto a tutela'
    ]
  };
  let best: { key: 'divorcio' | 'matrimonio' | 'filiacion' | 'tutela'; score: number } | null = null;
  for (const key of Object.keys(sets) as Array<'divorcio' | 'matrimonio' | 'filiacion' | 'tutela'>) {
    const kws = sets[key];
    const score = kws.reduce((acc, kw) => (q.includes(kw) ? acc + 1 : acc), 0);
    if (!best || score > best.score) best = { key, score };
  }
  if (best && best.score > 0) return best.key;
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  const { query, matter, submatter, jurisdiccion, topK } = req.body || {};
  const q = typeof query === 'string' ? query.trim() : '';
  if (!q) return res.status(400).json({ error: 'query requerida' });
  const m = typeof matter === 'string' ? matter : 'CIVIL';
  const s = typeof submatter === 'string' ? submatter : 'PERSONAS Y FAMILIA';
  const j = typeof jurisdiccion === 'string' ? jurisdiccion : 'GTO';
  const k = Number.isFinite(Number(topK)) ? Math.min(20, Math.max(1, Math.floor(Number(topK)))) : 5;
  const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  try {
    await ensureVectorReady();
    await ensureMetadataReady();
    const vec = await embedQuery(apiKey, q);
    const vecString = `[${vec.join(',')}]`;
    const detected = s === 'PERSONAS Y FAMILIA' ? detectSubmatter(q) : null;
    const baseLimit = detected ? Math.max(k * 4, 20) : k;
    const currentSource =
      m === 'CIVIL' && j === 'ESTATAL' && s === 'Procesal/Adjetivo'
        ? 'CPC'
        : (m === 'CIVIL' && j === 'ESTATAL' && s === 'Sustantivo' ? 'CC' : null);
    const exactMatch = q.match(/art[íi]?culo\s+(\d+)/i);
    let exact: Array<{ id: string; title: string; content: string; score: number; sourceType?: string }> = [];
    if (exactMatch) {
      const num = exactMatch[1];
      if (currentSource) {
        exact = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>(
          `SELECT "id","title","content","sourceType", 1.0 AS "score"
           FROM "Document"
           WHERE "embedding" IS NOT NULL
             AND "matter" = $1
             AND "submatter" = $2
             AND "jurisdiccion" = $3
             AND "sourceType" = $4
             AND "active" = true
             AND ("title" = $5 OR "title" ILIKE $6)
           LIMIT 3`,
          m, s, j, currentSource, `Artículo ${num}`, `Artículo ${num}%`
        );
      }
    }
    let baseResults: Array<{ id: string; title: string; content: string; score: number; sourceType?: string }> = [];
    if (currentSource) {
      baseResults = await prisma.$queryRaw`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter" = ${m}
          AND "submatter" = ${s}
          AND "jurisdiccion" = ${j}
          AND "sourceType" = ${currentSource}
          AND "active" = true
        ORDER BY "embedding" <=> ${vecString}::vector
        LIMIT ${baseLimit};
      `;
    } else {
      baseResults = await prisma.$queryRaw`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter" = ${m}
          AND "submatter" = ${s}
          AND "jurisdiccion" = ${j}
          AND "active" = true
        ORDER BY "embedding" <=> ${vecString}::vector
        LIMIT ${baseLimit};
      `;
    }
    const uniq = new Map<string, { id: string; title: string; content: string; score: number; sourceType?: string }>();
    for (const r of (exact || [])) if (!uniq.has(r.id)) uniq.set(r.id, r);
    for (const r of baseResults) if (!uniq.has(r.id)) uniq.set(r.id, r);
    let results = Array.from(uniq.values());
    if (results.length > k) results = results.slice(0, k);
    if (detected) {
      process.stdout.write(`figureDetected=${detected}\n`);
      const patternsByFigure: Record<'divorcio' | 'matrimonio' | 'filiacion' | 'tutela', string[]> = {
        divorcio: ['divorcio', 'incausado', 'separación', 'separacion', 'disolución', 'disolucion'],
        matrimonio: ['matrimonio', 'nupcias', 'esponsales', 'impedimentos', 'capacidad matrimonial'],
        filiacion: ['filiación', 'filiacion', 'paternidad', 'maternidad', 'impugnación de filiación', 'impugnacion de filiacion', 'reconocimiento de hijo'],
        tutela: ['tutela', 'tutor', 'curatela', 'interdicción', 'interdiccion', 'incapaz', 'incapacidad']
      };
      const pats = patternsByFigure[detected];
      const qf = (text: string) => {
        const t = String(text || '').toLowerCase();
        return pats.some((kw) => t.includes(kw));
      };
      const filtered = results.filter((r) => qf(r.content));
      results = (filtered.length > 0 ? filtered : results).slice(0, k);
    }
    return res.status(200).json({
      query: q,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        score: typeof r.score === 'number' ? Number(r.score.toFixed(4)) : (r as any).score,
        sourceType: (r as any).sourceType || null
      }))
    });
  } catch (e: any) {
    process.stderr.write(`rag/search error: ${String(e?.message || e)}\n`);
    return res.status(500).json({ error: e?.message || 'Error interno' });
  }
}
