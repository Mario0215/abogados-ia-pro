import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { getCaseFinancialSummary } from '../../../lib/finance';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArticleNumber(title?: string): string | null {
  if (!title) return null;
  const m = title.match(/art[íi]culo\s+(\d+)/i);
  return m && m[1] ? m[1] : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId, text } = req.body || {};
  if (!caseId || typeof text !== 'string') return res.status(400).json({ error: 'Datos requeridos' });

  const lc = await prisma.legalCase.findUnique({
    where: { id: String(caseId) },
    include: { client: true }
  });
  if (!lc) return res.status(404).json({ error: 'Caso no encontrado' });
  if (!canAccessLegalCase(auth, lc)) return res.status(404).json({ error: 'Caso no encontrado' });

  try {
    const financial = await getCaseFinancialSummary(prisma as any, String(caseId));
    const precio = typeof financial?.precioCliente === 'number' ? Number(financial.precioCliente) : 0;
    const required = precio > 0 ? Math.round(precio * 0.5) : 0;
    if (required > 0) {
      const paid = Number(financial?.totalCobrado || 0);
      if (paid < required) {
        return res.status(402).json({ error: 'Pago pendiente', required, paid });
      }
    }
  } catch {
    return res.status(503).json({ error: 'No fue posible validar el estado de pago del expediente.' });
  }
  let counterpartyAddress: string | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ counterpartyAddress: string | null }>>(
      `SELECT "counterpartyAddress" FROM "LegalCase" WHERE "id" = $1`, String(caseId)
    );
    counterpartyAddress = rows?.[0]?.counterpartyAddress || null;
  } catch {}

  let knowledge: Array<{ title?: string | null; snippet?: string | null; sourceType?: string | null; score?: number | null }> = [];
  try {
    const rows = await prisma.$queryRaw<Array<{ title: string; snippet?: string | null; sourceType?: string | null; score?: number | null }>>`
      SELECT d."title" as "title", k."snippet" as "snippet", k."sourceType" as "sourceType", k."score" as "score"
      FROM "CaseKnowledge" k
      JOIN "Document" d ON d."id" = k."documentId"
      WHERE k."caseId" = ${String(caseId)}
      ORDER BY k."score" DESC NULLS LAST
      LIMIT 10
    `;
    knowledge = rows as any;
  } catch {
    knowledge = [];
  }

  const intent = String((lc as any).intent || '').trim();
  const intentNorm = normalize(intent);
  const keywords = new Set(
    intentNorm
      .split(' ')
      .filter(w => w.length >= 6)
  );

  // Paso 1: Poda no destructiva (conservadora)
  const bannedCivil: RegExp[] = [
    /\bpenal(es)?\b/i,
    /\bdelito(s)?\b/i,
    /\bmercantil(es)?\b/i,
    /\bcomercio\b/i,
    /\blaboral(es)?\b/i,
    /\blempleado(s)?\b/i,
    /\btrabajo(s)?\b/i,
  ];
  const lines = String(text).split(/\r?\n/);
  const paras: string[] = [];
  let buf: string[] = [];
  function flush() {
    if (buf.length) {
      paras.push(buf.join('\n'));
      buf = [];
    }
  }
  for (const ln of lines) {
    if (ln.trim() === '') {
      flush();
    } else {
      buf.push(ln);
    }
  }
  flush();

  const kept: string[] = [];
  const removed: string[] = [];
  const topArticles = knowledge
    .filter(k => k && typeof k.score === 'number')
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .slice(0, 6);
  const topNums = new Set(topArticles.map(k => extractArticleNumber(k.title || '')).filter(Boolean) as string[]);

  for (const p of paras) {
    const pn = normalize(p);
    const hasBanned = bannedCivil.some(rx => rx.test(p));
    // Coincidencia de palabras con la pretensión
    const overlap = Array.from(keywords).some(kw => pn.includes(kw));
    // Tiene artículo recomendado
    const m = p.match(/art[íi]culo\s+(\d+)/i);
    const artOk = m && m[1] ? topNums.has(m[1]) : false;

    // Umbral conservador: solo eliminamos si es tema claramente ajeno (penal/mercantil/laboral)
    // o si no hay ninguna coincidencia con la pretensión y además contiene artículos no recomendados explícitos
    if (hasBanned || (!overlap && m && !artOk)) {
      // Eliminamos
      // Nota: no agregamos al texto; registramos para reporte
      removed.push(p);
    } else {
      kept.push(p);
    }
  }

  let out = kept.join('\n\n');

  // Paso 2: Relleno dinámico de variables
  const map: Record<string, string> = {
    '[NOMBRE_ACTOR]': lc.client?.name || '[FALTA_DATO:NOMBRE_ACTOR]',
    '[DOMICILIO]': lc.client?.address || '[FALTA_DATO:DOMICILIO]',
    '[TELEFONO]': lc.client?.phone || '[FALTA_DATO:TELEFONO]',
    '[CORREO]': lc.client?.email || '[FALTA_DATO:CORREO]',
    '[EXPEDIENTE]': lc.expediente || '[FALTA_DATO:EXPEDIENTE]',
    '[CONTRAPARTE]': (lc as any).counterparty || '[FALTA_DATO:CONTRAPARTE]',
    '[DOMICILIO_DEMANDADO]': counterpartyAddress || '[FALTA_DATO:DOMICILIO_DEMANDADO]',
    '[ROL]': (lc as any).party || '[FALTA_DATO:ROL]'
  };
  out = out.replace(/\[(NOMBRE_ACTOR|DOMICILIO|TELEFONO|CORREO|EXPEDIENTE|CONTRAPARTE|DOMICILIO_DEMANDADO|ROL)\]/g, (m) => map[m] || m);

  // Paso 3: Ajuste de Derecho (refuerzo con artículos sugeridos)
  const bestCC = topArticles.find(k => (k.sourceType || '').toUpperCase() === 'CC');
  const bestCPC = topArticles.find(k => (k.sourceType || '').toUpperCase() === 'CPC');
  const refs: string[] = [];
  if (bestCC) {
    const num = extractArticleNumber(bestCC.title || '');
    refs.push(`Artículo ${num || ''} CC – ${bestCC.title}`);
  }
  if (bestCPC) {
    const num = extractArticleNumber(bestCPC.title || '');
    refs.push(`Artículo ${num || ''} CPC – ${bestCPC.title}`);
  }
  if (refs.length) {
    // Strip any existing "Fundamentos sugeridos" blocks to avoid duplication on repeated Refinar calls
    out = out.replace(/\n\nFundamentos sugeridos[^\n]*:\n(- [^\n]*\n?)*/g, '').trimEnd();
    out = `${out}\n\nFundamentos sugeridos (relevancia alta):\n- ${refs.join('\n- ')}`;
  }

  // Paso 4: Sustitución de folio (PROV → Real cuando aplique)
  const expReal = String(((lc as any)?.expedienteReal || '')).trim();
  const folioProv = String(((lc as any)?.folioProvisional || '')).trim();
  if (expReal) {
    if (folioProv) {
      out = out.split(folioProv).join(expReal);
    }
    out = out.replace(/\[FOLIO_PROVISIONAL\]/g, expReal);
  } else if (folioProv) {
    out = out.replace(/\[FOLIO_PROVISIONAL\]/g, folioProv);
  }

  return res.status(200).json({
    text: out,
    removedCount: removed.length,
    message: 'Borrador depurado y ajustado a la pretensión'
  });
}
