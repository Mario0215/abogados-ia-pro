import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

const DEMAND_TYPES = [
  'divorcio',
  'alimentos',
  'guarda-custodia',
  'usucapion',
  'arrendamiento',
  'sucesion',
  'danos-perjuicios',
  'nulidad-contrato',
  'cumplimiento-contrato',
  'interdiccion'
] as const;

const SECTIONS = ['HECHOS', 'DERECHO', 'PRESTACIONES'] as const;

async function classifyDocument(
  apiKey: string,
  doc: { id: string; title: string; content: string; sourceType: string | null }
): Promise<{ demandTags: string[]; legalSection: string[] }> {
  const snippet = String(doc.content || '').slice(0, 1200);
  const prompt = `Analiza el siguiente artículo legal mexicano y clasifícalo.

TÍTULO: ${doc.title}
TIPO DE FUENTE: ${doc.sourceType || 'desconocido'}
CONTENIDO (fragmento):
${snippet}

Responde SOLO con JSON válido en este formato exacto:
{
  "demandTags": ["lista de tipos de demanda civil aplicables"],
  "legalSection": ["lista de secciones de demanda donde se usa este artículo"]
}

Para "demandTags" usa solo valores de esta lista (puede ser vacío []):
${DEMAND_TYPES.join(', ')}

Para "legalSection" usa solo valores de esta lista (puede ser vacío []):
${SECTIONS.join(', ')}

Criterios:
- HECHOS: artículos que describen derechos, obligaciones, causales o requisitos materiales
- DERECHO: artículos de procedimiento, competencia, plazos procesales, recursos
- PRESTACIONES: artículos que fundamentan lo que se puede pedir/reclamar (efectos, consecuencias)
- Un artículo puede pertenecer a múltiples tipos de demanda y múltiples secciones.
- Si el artículo no aplica a ningún tipo de demanda civil contenciosa, deja demandTags vacío.`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })
  });

  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(raw);
    const demandTags = (Array.isArray(parsed.demandTags) ? parsed.demandTags : [])
      .filter((t: string) => DEMAND_TYPES.includes(t as any));
    const legalSection = (Array.isArray(parsed.legalSection) ? parsed.legalSection : [])
      .filter((s: string) => SECTIONS.includes(s as any));
    return { demandTags, legalSection };
  } catch {
    return { demandTags: [], legalSection: [] };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    // Return tagging progress stats
    try {
      const total = await prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "Document" WHERE "active" = true`
      );
      const tagged = await prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "Document" WHERE "active" = true AND "demandTags" IS NOT NULL AND "demandTags" != '[]'`
      );
      return res.status(200).json({
        total: Number(total[0]?.count || 0),
        tagged: Number(tagged[0]?.count || 0)
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  }

  if (req.method === 'POST') {
    const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

    const { onlyUntagged = true, limit = 50 } = req.body || {};

    try {
      const whereClause = onlyUntagged
        ? `WHERE "active" = true AND ("demandTags" IS NULL OR "demandTags" = '[]') AND "content" IS NOT NULL`
        : `WHERE "active" = true AND "content" IS NOT NULL`;

      const docs = await prisma.$queryRawUnsafe<
        Array<{ id: string; title: string; content: string; sourceType: string | null }>
      >(
        `SELECT "id","title","content","sourceType" FROM "Document" ${whereClause} LIMIT $1`,
        Number(limit)
      );

      if (!docs.length) return res.status(200).json({ processed: 0, message: 'No hay documentos para procesar' });

      let processed = 0;
      let errors = 0;
      const results: Array<{ id: string; title: string; demandTags: string[]; legalSection: string[]; error?: string }> = [];

      for (const doc of docs) {
        try {
          const tags = await classifyDocument(apiKey, doc);
          await prisma.$executeRawUnsafe(
            `UPDATE "Document" SET "demandTags" = $1, "legalSection" = $2 WHERE "id" = $3`,
            JSON.stringify(tags.demandTags),
            JSON.stringify(tags.legalSection),
            doc.id
          );
          results.push({ id: doc.id, title: doc.title, ...tags });
          processed++;
          // Small delay to avoid rate limits
          await new Promise((r) => setTimeout(r, 200));
        } catch (e: any) {
          errors++;
          results.push({ id: doc.id, title: doc.title, demandTags: [], legalSection: [], error: e?.message });
        }
      }

      return res.status(200).json({ processed, errors, results });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
