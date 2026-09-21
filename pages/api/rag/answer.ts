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
    await prisma.$executeRawUnsafe(`
      UPDATE "Document" SET "sourceType"='CNPCF'
      WHERE "sourceType" IS NULL AND "matter"='CIVIL' AND "jurisdiccion"='FEDERAL'
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Document" SET "submatter"='Sustantivo'
      WHERE "matter"='CIVIL' AND "sourceType"='CC' AND ("submatter" IS NULL OR "submatter"='')
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
    divorcio: ['divorcio', 'incausado', 'separación', 'separacion', 'disolución', 'disolucion'],
    matrimonio: ['matrimonio', 'nupcias', 'esponsales', 'impedimentos', 'capacidad matrimonial', 'celebración', 'celebracion'],
    filiacion: ['filiación', 'filiacion', 'paternidad', 'maternidad', 'impugnación de filiación', 'impugnacion de filiacion', 'reconocimiento de hijo'],
    tutela: ['tutela', 'tutor', 'curatela', 'interdicción', 'interdiccion', 'incapaz', 'incapacidad']
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

function safeTruncate(text: string, max: number): string {
  const t = String(text || '');
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

function normalizeCitations(text: string, sources: Array<{ title: string; id: string }>): string {
  try {
    let out = String(text || '');
    return out;
  } catch {
    return text;
  }
}

function summarizeQuestion(q: string): string {
  try {
    const s = String(q || '').trim();
    const m = s.match(/art[íi]culo\s+(\d+)/i);
    if (m && m[1]) return `Artículo ${m[1]}`;
    const words = s.split(/\s+/).slice(0, 7).join(' ');
    return words || 'Consulta';
  } catch {
    return 'Consulta';
  }
}

function needsFraming(query: string): string | null {
  try {
    const q = String(query || '').toLowerCase();
    const terms = [
      'divorcio incausado',
      'divorcio incausado',
      'incausado',
      'divorcio exprés',
      'divorcio expres',
      'expres',
      'exprés',
      'divorcio unilateral'
    ];
    for (const t of terms) {
      if (q.includes(t)) return t;
    }
    return null;
  } catch {
    return null;
  }
}

function extractArticleNumbersFromSources(sources: Array<{ title: string; id: string }>): string[] {
  try {
    const nums: string[] = [];
    for (const s of sources) {
      const m = String(s.title || '').match(/Artículo\s+(\d+)/i);
      if (m && m[1]) nums.push(m[1]);
    }
    const uniq = Array.from(new Set(nums));
    uniq.sort((a, b) => Number(a) - Number(b));
    return uniq;
  } catch {
    return [];
  }
}

function applyFraming(query: string, answer: string, matter: string, submatter: string, jurisdiccion: string, sources: Array<{ title: string; id: string }>): string {
  const trigger = needsFraming(query);
  if (!trigger) return answer;
  if (matter !== 'CIVIL') return answer;
  if (jurisdiccion !== 'GTO') return answer;
  if (submatter !== 'PERSONAS Y FAMILIA') return answer;
  const arts = extractArticleNumbersFromSources(sources);
  if (!arts || arts.length === 0) return answer;
  const has323 = arts.includes('323');
  const cited = has323 ? 'Artículo 323' : (arts.length === 1 ? `Artículo ${arts[0]}` : `Artículos ${arts.slice(0, 2).join(' y ')}`);
  const intro = [
    `En el Código Civil del Estado de Guanajuato no se regula "${trigger}" como una figura autónoma.`,
    `El divorcio se encuentra regulado a través de las causas previstas en el ${cited} del Código Civil del Estado de Guanajuato.`,
    `Por ello, aunque no exista "${trigger}" en sentido estricto, la disolución del vínculo matrimonial puede obtenerse conforme a las causas previstas en dicho precepto.`,
    ``
  ].join(' ');
  const combined = `${intro}\n${answer}`;
  return combined;
}

async function chatCompletionWithRetry(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: any = null;
  while (attempt < maxAttempts) {
    try {
      const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      if (!completionRes.ok) {
        const text = await completionRes.text();
        if ([429, 500, 502, 503, 504].includes(completionRes.status)) {
          throw new Error(`OpenAI ${completionRes.status} ${text}`);
        }
        throw new Error(`OpenAI ${completionRes.status}`);
      }
      const compData = await completionRes.json();
      const answer: string =
        compData?.choices?.[0]?.message?.content ||
        'No fue posible generar una respuesta con la información disponible.';
      return answer;
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  process.stderr.write(`chatCompletion failed: ${String(lastError?.message || lastError)}\n`);
  throw lastError;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  const { query, matter, submatter, jurisdiccion, topK, integral, mode } = req.body || {};
  const q = typeof query === 'string' ? query.trim() : '';
  if (!q) return res.status(400).json({ error: 'query requerida' });
  const m = typeof matter === 'string' ? matter : 'CIVIL';
  const s = typeof submatter === 'string' ? submatter : 'PERSONAS Y FAMILIA';
  const j = typeof jurisdiccion === 'string' ? jurisdiccion : 'GTO';
  const k = Number.isFinite(Number(topK)) ? Math.min(20, Math.max(1, Math.floor(Number(topK)))) : 10;
  const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  try {
    const log = await prisma.chatLog.create({
      data: {
        userId: auth.uid,
        question: q,
        matter: m,
        jurisdiccion: j,
        summary: summarizeQuestion(q)
      }
    });
    await ensureMetadataReady();
    // Asegurar etiquetado CNPCF para Federal/Civil
    if (m === 'CIVIL' && j === 'FEDERAL') {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "Document" SET "sourceType"='CNPCF'
          WHERE "matter"='CIVIL' AND "jurisdiccion"='FEDERAL' AND COALESCE("sourceType",'')<>'CNPCF'
        `);
      } catch {}
    }
    const currentSource =
      m === 'CIVIL' && j === 'ESTATAL' && s === 'Procesal/Adjetivo'
        ? 'CPC'
        : (m === 'CIVIL' && j === 'ESTATAL' && s === 'Sustantivo'
          ? 'CC'
          : (m === 'CIVIL' && j === 'FEDERAL' ? 'CNPCF' : null));
    const effSubmatter = currentSource === 'CNPCF' ? 'Procesal/Adjetivo' : s;
    const numericOnly = /^\s*art[íi]?culo\s*(\d+)\s*$/i.exec(q);
    const jFilter = j;
    if (numericOnly) {
      const num = numericOnly[1];
      let exactRow: Array<{ id: string; title: string; content: string; sourceType?: string }> = [];
      const tExact = `Artículo ${num}`;
      const tLike = `Artículo ${num} %`;
      if (currentSource) {
        exactRow = await prisma.$queryRawUnsafe(
          `SELECT "id","title","content","sourceType"
           FROM "Document"
           WHERE "matter" = $1
             AND "sourceType" = $2
             AND "active" = true
             AND ("title" = $3 OR "title" LIKE $4)
           LIMIT 1`,
          m, currentSource, tExact, tLike
        );
      } else {
        exactRow = await prisma.$queryRawUnsafe(
          `SELECT "id","title","content","sourceType"
           FROM "Document"
           WHERE "matter" = $1
             AND "active" = true
             AND ("title" = $2 OR "title" LIKE $3)
           LIMIT 1`,
          m, tExact, tLike
        );
      }
      if (!exactRow || exactRow.length === 0) {
        const notFound = 'Artículo no encontrado en este ordenamiento.';
        await prisma.chatLog.update({ where: { id: (log as any).id }, data: { answer: notFound } });
        return res.status(200).json({
          query: q,
          answer: notFound,
          sources: [],
          usedVector: false,
          exactPartial: false,
          fallbackWide: false
        });
      }
      const exact = exactRow[0];
      await prisma.chatLog.update({ where: { id: (log as any).id }, data: { answer: exact.content || '' } });
      return res.status(200).json({
        query: q,
        answer: exact.content || '',
        sourceType: exact.sourceType || null,
        submatter: s,
        title: exact.title || null,
        sources: [{ id: exact.id, title: exact.title || '', sourceType: exact.sourceType || null }],
        id: (log as any).id,
        summary: (log as any).summary || summarizeQuestion(q),
        usedVector: false,
        exactPartial: false,
        fallbackWide: false
      });
    }
    // Modo híbrido Federal: CC (GTO/Estatal) para Fondo + CNPCyF para Forma
    if (m === 'CIVIL' && j === 'FEDERAL') {
      await ensureVectorReady();
      const qCC = `${q} sustantivo fondo causal`;
      const qCN = `${q} procesal trámite forma demanda`;
      const [vecCC, vecCN] = await Promise.all([embedQuery(apiKey, qCC), embedQuery(apiKey, qCN)]);
      const vecCCString = `[${vecCC.join(',')}]`;
      const vecCNString = `[${vecCN.join(',')}]`;
      const ccLimit = Math.ceil(k / 2);
      const cnLimit = Math.floor(k / 2);
      // CC Guanajuato (permitimos jurisdiccion ESTATAL o GTO por compatibilidad)
      const baseCC = await prisma.$queryRaw<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecCCString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter"='CIVIL'
          AND "submatter"='Sustantivo'
          AND "jurisdiccion" IN ('ESTATAL','GTO')
          AND "sourceType"='CC'
          AND "active"=true
        ORDER BY "embedding" <=> ${vecCCString}::vector
        LIMIT ${ccLimit};
      `;
      // CNPCyF
      const baseCN = await prisma.$queryRaw<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecCNString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter"='CIVIL'
          AND "submatter"='Procesal/Adjetivo'
          AND "jurisdiccion"='FEDERAL'
          AND "sourceType"='CNPCF'
          AND "active"=true
        ORDER BY "embedding" <=> ${vecCNString}::vector
        LIMIT ${cnLimit};
      `;
      const perArticleLimit = 1200;
      const formattedCC = (baseCC || []).map((r) => `- ${r.title} (Código Civil de Guanajuato): ${safeTruncate(r.content || '', perArticleLimit)}`).join('\n');
      const formattedCN = (baseCN || []).map((r) => `- ${r.title} (Código Nacional de Procedimientos Civiles y Familiares): ${safeTruncate(r.content || '', perArticleLimit)}`).join('\n');
      if ((!baseCC || baseCC.length === 0) && (!baseCN || baseCN.length === 0)) {
        return res.status(200).json({
          query: q,
          answer: 'Artículo no encontrado en este ordenamiento.',
          sources: []
        });
      }
      const systemPrompt = "Eres un asistente jurídico especializado en derecho civil del Estado de Guanajuato. Responde ÚNICAMENTE con base en los artículos y jurisprudencias que se te proporcionan en el contexto.  REGLAS ESTRICTAS: 1. NUNCA inventes artículos, fechas ni jurisprudencias 2. NUNCA recomiendes consultar a otro abogado 3. NUNCA des respuestas genéricas — si no tienes contexto suficiente di exactamente: 'No encontré artículos suficientes en los códigos disponibles para responder esta pregunta con precisión. Te recomiendo ampliar la búsqueda.' 4. SIEMPRE cita el número exacto del artículo y el ordenamiento (CC GTO, CPC GTO, CNPCF o Jurisprudencia STJGTO) tal como aparece en el contexto 5. Responde de forma directa e integrada como abogado hablando con otro abogado 6. NUNCA uses secciones separadas de Fondo y Forma — integra todo en una sola respuesta fluida";
      const userPrompt = [
        'Consulta del usuario:',
        q,
        '',
        'Contexto para Fondo (Sustantivo) - CC Guanajuato:',
        formattedCC || '(sin contexto suficiente)',
        '',
        'Contexto para Forma (Procesal) - CNPCyF:',
        formattedCN || '(sin contexto suficiente)',
        '',
        'Responde de forma integrada y directa, citando los artículos relevantes dentro del texto.'
      ].join('\n');
      const answerHybrid = await chatCompletionWithRetry(apiKey, systemPrompt, userPrompt);
      const allSources = [...(baseCC || []), ...(baseCN || [])];
      const normalized = normalizeCitations(answerHybrid, allSources.map((r) => ({ title: r.title, id: r.id })));
      await prisma.chatLog.update({
        where: { id: (log as any).id },
        data: { answer: normalized }
      });
      return res.status(200).json({
        query: q,
        answer: normalized,
        sourceType: 'HYBRID_CC_CNPCF',
        submatter: null,
        title: null,
        sources: allSources.map((r) => ({ id: r.id, title: r.title, sourceType: (r as any).sourceType || null })),
        id: (log as any).id,
        summary: (log as any).summary || summarizeQuestion(q),
        usedVector: true,
        exactPartial: false,
        fallbackWide: false
      });
    }
    const isIntegral =
      j === 'ESTATAL' && (
        (!!integral && String(integral) !== 'false') ||
        (typeof mode === 'string' && ['INTEGRAL', 'GENERAL', 'CIVIL: INTEGRAL', 'CIVIL: ESTRATEGIA'].includes(mode.toUpperCase()))
      );
    if (isIntegral) {
      await ensureVectorReady();
      const qCC = `${q} sustantivo fondo causal`;
      const qCPC = `${q} procesal trámite forma demanda`;
      const [vecCC, vecCPC] = await Promise.all([embedQuery(apiKey, qCC), embedQuery(apiKey, qCPC)]);
      const vecCCString = `[${vecCC.join(',')}]`;
      const vecCPCString = `[${vecCPC.join(',')}]`;
      const exactMatch = q.match(/art[íi]?culo\s+(\d+)/i);
      let exactCC: Array<{ id: string; title: string; content: string; score: number; sourceType?: string }> = [];
      let exactCPC: Array<{ id: string; title: string; content: string; score: number; sourceType?: string }> = [];
      if (exactMatch) {
        const num = exactMatch[1];
        const eExact = `Artículo ${num}`;
        const eLike = `Artículo ${num} %`;
        exactCC = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>(
          `SELECT "id","title","content","sourceType", 1.0 AS "score"
           FROM "Document"
           WHERE "matter" = $1
             AND "submatter" = $2
             AND "jurisdiccion" = $3
             AND "sourceType" = 'CC'
             AND "active" = true
             AND ("title" = $4 OR "title" LIKE $5)
           LIMIT 3`,
          m, 'Sustantivo', jFilter, eExact, eLike
        );
        exactCPC = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>(
          `SELECT "id","title","content","sourceType", 1.0 AS "score"
           FROM "Document"
           WHERE "matter" = $1
             AND "submatter" = $2
             AND "jurisdiccion" = $3
             AND "sourceType" = 'CPC'
             AND "active" = true
             AND ("title" = $4 OR "title" LIKE $5)
           LIMIT 3`,
          m, 'Procesal/Adjetivo', jFilter, eExact, eLike
        );
      }
      const ccLimit = Math.ceil(k / 2);
      const cpcLimit = Math.floor(k / 2);
      const baseCC = await prisma.$queryRaw`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecCCString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter" = ${m}
          AND "submatter" = ${'Sustantivo'}
          AND "jurisdiccion" = ${jFilter}
          AND "sourceType" = ${'CC'}
          AND "active" = true
        ORDER BY "embedding" <=> ${vecCCString}::vector
        LIMIT ${ccLimit};
      `;
      const baseCPC = await prisma.$queryRaw`
        SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecCPCString}::vector) AS "score"
        FROM "Document"
        WHERE "embedding" IS NOT NULL
          AND "matter" = ${m}
          AND "submatter" = ${'Procesal/Adjetivo'}
          AND "jurisdiccion" = ${jFilter}
          AND "sourceType" = ${'CPC'}
          AND "active" = true
        ORDER BY "embedding" <=> ${vecCPCString}::vector
        LIMIT ${cpcLimit};
      `;
      const uniqCC = new Map<string, { id: string; title: string; content: string; score: number; sourceType?: string }>();
      for (const r of (exactCC || [])) if (!uniqCC.has(r.id)) uniqCC.set(r.id, r);
      for (const r of (baseCC as any)) if (!uniqCC.has(r.id)) uniqCC.set(r.id, r);
      let resultsCC = Array.from(uniqCC.values()).slice(0, ccLimit);
      const uniqCPC = new Map<string, { id: string; title: string; content: string; score: number; sourceType?: string }>();
      for (const r of (exactCPC || [])) if (!uniqCPC.has(r.id)) uniqCPC.set(r.id, r);
      for (const r of (baseCPC as any)) if (!uniqCPC.has(r.id)) uniqCPC.set(r.id, r);
      let resultsCPC = Array.from(uniqCPC.values()).slice(0, cpcLimit);
      const perArticleLimit = 1200;
      const formattedCC = resultsCC.map((r) => `- ${r.title} (Código Civil de Guanajuato): ${safeTruncate(r.content || '', perArticleLimit)}`).join('\n');
      const formattedCPC = resultsCPC.map((r) => `- ${r.title} (Código de Procedimientos Civiles de Guanajuato): ${safeTruncate(r.content || '', perArticleLimit)}`).join('\n');
      const systemPrompt = "Eres un asistente jurídico especializado en derecho civil del Estado de Guanajuato. Responde ÚNICAMENTE con base en los artículos y jurisprudencias que se te proporcionan en el contexto.  REGLAS ESTRICTAS: 1. NUNCA inventes artículos, fechas ni jurisprudencias 2. NUNCA recomiendes consultar a otro abogado 3. NUNCA des respuestas genéricas — si no tienes contexto suficiente di exactamente: 'No encontré artículos suficientes en los códigos disponibles para responder esta pregunta con precisión. Te recomiendo ampliar la búsqueda.' 4. SIEMPRE cita el número exacto del artículo y el ordenamiento (CC GTO, CPC GTO, CNPCF o Jurisprudencia STJGTO) tal como aparece en el contexto 5. Responde de forma directa e integrada como abogado hablando con otro abogado 6. NUNCA uses secciones separadas de Fondo y Forma — integra todo en una sola respuesta fluida";
      const userPrompt = [
        'Consulta del usuario:',
        q,
        '',
        'Contexto para Fondo (Sustantivo) - CC:',
        formattedCC || '(sin contexto suficiente)',
        '',
        'Contexto para Forma (Procesal) - CPC:',
        formattedCPC || '(sin contexto suficiente)',
        '',
        'Responde de forma integrada y directa, citando los artículos relevantes dentro del texto.'
      ].join('\n');
      const answer = await chatCompletionWithRetry(apiKey, systemPrompt, userPrompt);
      const allSources = [...resultsCC, ...resultsCPC];
      const normalizedAnswer = normalizeCitations(answer, allSources.map((r) => ({ title: r.title, id: r.id })));
      await prisma.chatLog.update({
        where: { id: (log as any).id },
        data: { answer: normalizedAnswer }
      });
      const exactPartial = !!exactMatch && (exactCC.length > 0 || exactCPC.length > 0);
      return res.status(200).json({
        query: q,
        answer: normalizedAnswer,
        sourceType: 'INTEGRAL',
        submatter: null,
        title: null,
        sources: allSources.map((r) => ({ title: r.title, id: r.id, sourceType: (r as any).sourceType || null })),
        id: (log as any).id,
        summary: (log as any).summary || summarizeQuestion(q),
        usedVector: true,
        exactPartial,
        fallbackWide: false
      });
    }
    await ensureVectorReady();
    const vec = await embedQuery(apiKey, q);
    const vecString = `[${vec.join(',')}]`;
    const detected = s === 'PERSONAS Y FAMILIA' ? detectSubmatter(q) : null;
    const baseLimit = detected ? Math.max(k * 4, 20) : k;
    const exactMatch = q.match(/art[íi]?culo\s+(\d+)/i);
    let exact: Array<{ id: string; title: string; content: string; score: number; sourceType?: string }> = [];
    if (exactMatch) {
      const num = exactMatch[1];
      if (currentSource) {
        const eExact = `Artículo ${num}`;
        const eLike = `Artículo ${num} %`;
        exact = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string; score: number; sourceType?: string }>>(
          `SELECT "id","title","content","sourceType", 1.0 AS "score"
           FROM "Document"
           WHERE "matter" = $1
             AND "submatter" = $2
             AND "jurisdiccion" = $3
             AND "sourceType" = $4
             AND "active" = true
             AND ("title" = $5 OR "title" LIKE $6)
           LIMIT 3`,
          m, effSubmatter, jFilter, currentSource, eExact, eLike
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
          AND "submatter" = ${effSubmatter}
          AND "jurisdiccion" = ${jFilter}
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
          AND "submatter" = ${effSubmatter}
          AND "jurisdiccion" = ${jFilter}
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
        matrimonio: ['matrimonio', 'nupcias', 'esponsales', 'impedimentos', 'capacidad matrimonial', 'celebración', 'celebracion'],
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
    } else {
      results = results.slice(0, k);
    }

    if (!results || results.length === 0) {
      return res.status(200).json({
        query: q,
        answer: 'Artículo no encontrado en este ordenamiento.',
        sources: []
      });
    }

    const perArticleLimit = 1200;
    const formatted = results.map((r) => {
      const label = (r as any).sourceType === 'CPC'
        ? '(Código de Procedimientos Civiles de Guanajuato)'
        : ((r as any).sourceType === 'CC' ? '(Código Civil del Estado de Guanajuato)' : '');
      return `- ${r.title} ${label}: ${safeTruncate(r.content || '', perArticleLimit)}`;
    }).join('\n');
    const systemPrompt = "Eres un asistente jurídico especializado en derecho civil del Estado de Guanajuato. Responde ÚNICAMENTE con base en los artículos y jurisprudencias que se te proporcionan en el contexto.  REGLAS ESTRICTAS: 1. NUNCA inventes artículos, fechas ni jurisprudencias 2. NUNCA recomiendes consultar a otro abogado 3. NUNCA des respuestas genéricas — si no tienes contexto suficiente di exactamente: 'No encontré artículos suficientes en los códigos disponibles para responder esta pregunta con precisión. Te recomiendo ampliar la búsqueda.' 4. SIEMPRE cita el número exacto del artículo y el ordenamiento (CC GTO, CPC GTO, CNPCF o Jurisprudencia STJGTO) tal como aparece en el contexto 5. Responde de forma directa e integrada como abogado hablando con otro abogado 6. NUNCA uses secciones separadas de Fondo y Forma — integra todo en una sola respuesta fluida";
    const userPrompt = [
      'Consulta del usuario:',
      q,
      '',
      'Contexto legal:',
      formatted,
      '',
      'Responde de forma integrada y directa, citando los artículos relevantes dentro del texto.'
    ].join('\n');

    const answer = await chatCompletionWithRetry(apiKey, systemPrompt, userPrompt);

    const normalizedAnswer = normalizeCitations(answer, results.map((r) => ({ title: r.title, id: r.id })));
    const framedAnswer = applyFraming(q, normalizedAnswer, m, s, j, results.map((r) => ({ title: r.title, id: r.id })));
    const finalAnswer = normalizeCitations(framedAnswer, results.map((r) => ({ title: r.title, id: r.id })));
    await prisma.chatLog.update({
      where: { id: (log as any).id },
      data: { answer: finalAnswer }
    });
    const debugExactPartial = (exact?.length || 0) > 0;
    const debugUsedVector = true;
    const debugFallbackWide = !currentSource;
    return res.status(200).json({
      query: q,
      answer: finalAnswer,
      sourceType: currentSource || null,
      submatter: effSubmatter,
      title: results[0]?.title || null,
      sources: results.map((r) => ({ title: r.title, id: r.id, sourceType: (r as any).sourceType || null })),
      id: (log as any).id,
      summary: (log as any).summary || summarizeQuestion(q),
      usedVector: debugUsedVector,
      exactPartial: debugExactPartial,
      fallbackWide: debugFallbackWide
    });
  } catch (e: any) {
    process.stderr.write(`rag/answer error: ${String(e?.message || e)}\n`);
    return res.status(500).json({ error: e?.message || 'Error interno' });
  }
}
