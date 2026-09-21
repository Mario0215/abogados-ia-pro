import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

function splitByArticles(text: string): string[] {
  const t = String(text || '').trim();
  if (!t) return [];
  const parts = t.split(/(?=Artículo\s+\d+)/g).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  if (auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  const { rawText, matter, submatter, jurisdiccion, validateOnly, autoFix, active } = req.body || {};
  const text = typeof rawText === 'string' ? rawText : '';
  const m = typeof matter === 'string' ? matter : 'CIVIL';
  const s = typeof submatter === 'string' ? submatter : 'Procesal/Adjetivo';
  const j = typeof jurisdiccion === 'string' ? jurisdiccion : 'ESTATAL';
  const isFederal = j === 'FEDERAL';
  const source = s === 'Sustantivo' ? 'CC' : (isFederal ? 'CNPCF' : 'CPC');
  // Compatibilidad del importador heredado: una carga nueva nace inactiva.
  // La publicación del núcleo jurídico nuevo se gobierna por LegalNormVersion.
  const shouldActivate = active === true;

  try {
    let stateId: string;
    if (isFederal) {
      let state = await prisma.state.findFirst({ where: { name: 'Federal' } });
      if (!state) {
        state = await prisma.state.create({ data: { name: 'Federal', active: true } });
      }
      stateId = state.id;
    } else {
      let state = await prisma.state.findFirst({ where: { name: 'Guanajuato' } });
      if (!state) {
        state = await prisma.state.create({ data: { name: 'Guanajuato', active: true } });
      }
      stateId = state.id;
    }
    if (validateOnly) {
      const nulls = await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "sourceType" IS NULL`);
      const cpcBad = await prisma.$queryRawUnsafe<{ c: number }[]>(`
        SELECT COUNT(*)::int AS c
        FROM "Document"
        WHERE "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL' AND COALESCE("sourceType",'')<>'CPC'
      `);
      const cpcOk = await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*)::int AS c FROM "Document" WHERE "sourceType"='CPC'`);
      let fixed = 0;
      if (autoFix) {
        const fix = await prisma.$executeRawUnsafe<number>(`
          UPDATE "Document"
          SET "sourceType"='CPC'
          WHERE "matter"='CIVIL' AND "submatter"='Procesal/Adjetivo' AND "jurisdiccion"='ESTATAL' AND COALESCE("sourceType",'')<>'CPC'
        `);
        fixed = typeof fix === 'number' ? fix : 0;
      }
      return res.status(200).json({
        ok: true,
        validation: {
          nullSourceType: nulls?.[0]?.c || 0,
          cpcMislabeled: cpcBad?.[0]?.c || 0,
          cpcTotal: cpcOk?.[0]?.c || 0,
          autoFixApplied: !!autoFix,
          fixed
        }
      });
    }

    if (!text.trim()) return res.status(400).json({ error: 'Texto requerido' });

    const firstArticleMatch = text.match(/Artículo\s+\d+/);
    let upserts = 0;
    if (firstArticleMatch) {
      const idx = text.indexOf(firstArticleMatch[0]);
      const header = text.slice(0, idx).trim();
      if (header.length > 0) {
        const prelimTitle =
          source === 'CC'
            ? 'Preliminar del Código Civil para el Estado de Guanajuato'
            : source === 'CPC'
            ? 'Preliminar del Código de Procedimientos Civiles para el Estado de Guanajuato'
            : 'Preliminar del Código Nacional de Procedimientos Civiles';
        const d0 = await prisma.document.upsert({
          where: { stateId_title: { stateId, title: prelimTitle } },
          update: { content: header, matter: m, submatter: s, jurisdiccion: j, active: shouldActivate },
          create: { title: prelimTitle, content: header, matter: m, submatter: s, jurisdiccion: j, stateId, active: shouldActivate }
        });
        await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"=$1 WHERE id=$2`, source, (d0 as any).id);
        upserts += 1;
      }
      const tail = text.slice(idx);
      const parts = splitByArticles(tail);
      for (const part of parts) {
        const am = part.match(/^Artículo\s+(\d+)/);
        const numero = am ? am[1] : undefined;
        let title =
          source === 'CC'
            ? (numero ? `Artículo ${numero} del Código Civil para el Estado de Guanajuato` : `Artículo del Código Civil para el Estado de Guanajuato`)
            : source === 'CPC'
            ? (numero ? `Artículo ${numero} del Código de Procedimientos Civiles para el Estado de Guanajuato` : `Artículo del Código de Procedimientos Civiles para el Estado de Guanajuato`)
            : (numero ? `Artículo ${numero} del Código Nacional de Procedimientos Civiles` : `Artículo del Código Nacional de Procedimientos Civiles`);
        const d = await prisma.document.upsert({
          where: { stateId_title: { stateId, title } },
          update: { content: part, matter: m, submatter: s, jurisdiccion: j, active: shouldActivate },
          create: { title, content: part, matter: m, submatter: s, jurisdiccion: j, stateId, active: shouldActivate }
        });
        await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"=$1 WHERE id=$2`, source, (d as any).id);
        upserts += 1;
      }
    } else {
      const prelimTitle =
        source === 'CC'
          ? 'Preliminar del Código Civil para el Estado de Guanajuato'
          : source === 'CPC'
          ? 'Preliminar del Código de Procedimientos Civiles para el Estado de Guanajuato'
          : 'Preliminar del Código Nacional de Procedimientos Civiles';
      const d = await prisma.document.upsert({
        where: { stateId_title: { stateId, title: prelimTitle } },
        update: { content: text.trim(), matter: m, submatter: s, jurisdiccion: j, active: shouldActivate },
        create: { title: prelimTitle, content: text.trim(), matter: m, submatter: s, jurisdiccion: j, stateId, active: shouldActivate }
      });
      await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"=$1 WHERE id=$2`, source, (d as any).id);
      upserts += 1;
    }
    const total = await prisma.document.count();
    return res.status(200).json({ ok: true, upserts, total });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Error interno' });
  }
}
