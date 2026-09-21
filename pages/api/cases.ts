import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(403).json({ error: 'No autorizado' });
  const user = await prisma.user.findUnique({ where: { id: auth.uid } });
  if (!user) return res.status(403).json({ error: 'Sesión inválida: usuario no existe' });

  async function embedQuery(apiKey: string, input: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const vec: number[] = data?.data?.[0]?.embedding || [];
    if (!Array.isArray(vec) || vec.length === 0) throw new Error('Embedding vacío');
    return vec;
  }

  function claimKeyFromIntent(intent?: string): string | null {
    if (!intent) return null;
    const t = intent.toLowerCase();
    const rules: Array<{ key: string; kws: string[] }> = [
      { key: 'DIVORCIO_ADULTERIO', kws: ['divorcio', 'adulterio'] },
      { key: 'DIVORCIO_ABANDONO', kws: ['divorcio', 'abandono'] },
      { key: 'RESOLUCION_CV_INC_ENTREGA', kws: ['resolución', 'resolucion', 'compra venta', 'compraventa', 'incumplimiento', 'entrega'] },
      { key: 'CANCELACION_CONTRATO', kws: ['cancelación', 'cancelacion', 'contrato'] }
    ];
    for (const r of rules) {
      if (r.kws.every(kw => t.includes(kw))) return r.key;
    }
    if (t.includes('divorcio')) return 'DIVORCIO';
    if (t.includes('alimentos') || t.includes('pensión') || t.includes('pension')) return 'ALIMENTOS';
    if (t.includes('usucapión') || t.includes('usucapion') || t.includes('prescripción adquisitiva') || t.includes('prescripcion adquisitiva')) return 'USUCAPION';
    if (t.includes('daño moral') || t.includes('dano moral')) return 'DANO_MORAL';
    if (t.includes('incumplimiento') && t.includes('contrato')) return 'INCUMPLIMIENTO_CONTRATO';
    if (t.includes('nulidad') && t.includes('contrato')) return 'NULIDAD_CONTRATO';
    if (t.includes('desahucio') || t.includes('lanzamiento') || t.includes('desalojo')) return 'DESAHUCIO';
    if (t.includes('cobro') || t.includes('deuda') || t.includes('pago')) return 'COBRO_PESOS';
    if (t.includes('interdicción') || t.includes('interdiccion') || t.includes('tutela')) return 'TUTELA';
    if (t.includes('herencia') || t.includes('sucesión') || t.includes('sucesion')) return 'SUCESION';
    if (t.includes('arrendamiento') || t.includes('renta') || t.includes('inquilino')) return 'ARRENDAMIENTO';
    if (t.includes('patria potestad') || t.includes('guarda') || t.includes('custodia')) return 'PATRIA_POTESTAD';
    return null;
  }

  if (req.method === 'POST') {
    if (auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
    try {
      const { type, matter, expediente, counterparty, counterpartyAddress, context, fee, client, clientId: bodyClientId, priority, status, notes, party, altaDate, intent } = req.body || {};
      if (!type || !counterparty) return res.status(400).json({ error: 'Datos incompletos' });
      let clientId: string | null = bodyClientId ? String(bodyClientId) : null;
      if (client && (client.name || client.email)) {
        const existingClient = await prisma.client.findFirst({
          where: { userId: auth.uid, name: String(client.name || '') }
        });
        if (existingClient) {
          await prisma.client.update({
            where: { id: existingClient.id },
            data: {
              phone: client.phone ? String(client.phone) : existingClient.phone,
              email: client.email ? String(client.email) : existingClient.email,
              address: client.address ? String(client.address) : existingClient.address
            }
          });
          clientId = existingClient.id;
        } else {
          const c = await prisma.client.create({
            data: {
              userId: auth.uid,
              name: String(client.name || ''),
              phone: client.phone ? String(client.phone) : null,
              email: client.email ? String(client.email) : null,
              address: client.address ? String(client.address) : null
            }
          });
          clientId = c.id;
        }
      }
      const existingCase = expediente
        ? await prisma.legalCase.findFirst({
            where: { userId: auth.uid, expediente: String(expediente) }
          })
        : null;
      if (existingCase) {
        return res.status(409).json({ error: 'Expediente ya existe' });
      }
      const lc = await prisma.legalCase.create({
            data: {
              userId: auth.uid,
              clientId,
              type: String(type),
              matter: String(matter || 'CIVIL'),
              intent: intent ? String(intent) : null,
              claimKey: claimKeyFromIntent(intent) || null,
              expediente: expediente ? String(expediente) : `EXP-${Date.now()}`,
              counterparty: String(counterparty),
              context: context ? String(context) : null,
              fee: fee ? Number(fee) : null,
              party: party ? String(party) : 'DEMANDANTE',
              priority: priority ? String(priority) : 'NORMAL',
              status: status ? String(status) : 'BORRADOR',
              notes: notes ? String(notes) : null,
              createdAt: altaDate ? new Date(String(altaDate)) : undefined
            }
          });
      if (counterpartyAddress) {
        try {
          await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "counterpartyAddress" = $1 WHERE "id" = $2`, String(counterpartyAddress), lc.id);
        } catch {}
      }
      // Prefetch RAG results for CC y CPC si hay intent y clave API
      try {
        const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
        if (apiKey && intent && intent.trim().length > 0) {
          const vec = await embedQuery(apiKey, String(intent));
          const vecString = `[${vec.join(',')}]`;
          const k = 8;
          const cc = await prisma.$queryRaw<Array<{ id: string; title: string; content: string; sourceType?: string; score: number }>>`
            SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecString}::vector) AS "score"
            FROM "Document"
            WHERE "embedding" IS NOT NULL
              AND "matter" = 'CIVIL'
              AND "submatter" = 'Sustantivo'
              AND "jurisdiccion" = 'ESTATAL'
              AND "sourceType" = 'CC'
              AND "active" = true
            ORDER BY "embedding" <=> ${vecString}::vector
            LIMIT ${k};
          `;
          const cpc = await prisma.$queryRaw<Array<{ id: string; title: string; content: string; sourceType?: string; score: number }>>`
            SELECT "id","title","content","sourceType", 1 - ("embedding" <=> ${vecString}::vector) AS "score"
            FROM "Document"
            WHERE "embedding" IS NOT NULL
              AND "matter" = 'CIVIL'
              AND "submatter" = 'Procesal/Adjetivo'
              AND "jurisdiccion" = 'ESTATAL'
              AND "sourceType" = 'CPC'
              AND "active" = true
            ORDER BY "embedding" <=> ${vecString}::vector
            LIMIT ${k};
          `;
          const toInsert = [...cc, ...cpc].slice(0, 2 * k);
          if (toInsert.length > 0) {
            const rows = toInsert.map((r) => ({
              id: `${lc.id}-${r.id}`,
              caseId: lc.id,
              documentId: r.id,
              sourceType: (r as any).sourceType || null,
              snippet: String(r.content || '').slice(0, 800),
              score: Number((r as any).score) || null
            }));
            for (const row of rows) {
              try {
                await prisma.$executeRawUnsafe(
                  `INSERT INTO "CaseKnowledge" ("id","caseId","documentId","sourceType","snippet","score") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
                  row.id, row.caseId, row.documentId, row.sourceType, row.snippet, row.score
                );
              } catch {}
            }
          }
        }
      } catch (e) {
        process.stderr.write(`prefetch error: ${String((e as any)?.message || e)}\n`);
      }
      await prisma.caseEvent.create({
        data: {
          caseId: lc.id,
          type: 'STATUS',
          to: lc.status,
          message: 'Caso creado'
        }
      });
      return res.status(201).json({ id: lc.id });
    } catch (e: any) {
      if (e?.code === 'P2003') return res.status(403).json({ error: 'Usuario inválido: llave foránea' });
      return res.status(500).json({ error: 'Error interno al crear caso' });
    }
  }

  if (req.method === 'GET') {
    const { page, pageSize, q, matter, status, priority } = req.query || {};
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const base: any = {
      isActive: true,
      expediente: q ? { contains: String(q) } : undefined,
      matter: matter ? String(matter) : undefined,
      status: status ? String(status) : undefined,
      priority: priority ? String(priority) : undefined
    };
    const where: any =
      auth.role === 'ADMIN'
        ? base
        : {
            ...base,
            abogadoId: auth.uid
          };
    const skip = (p - 1) * ps;
    const urgentWhere: any =
      auth.role === 'ADMIN'
        ? { ...base, isActive: true, priority: 'URGENTE' }
        : { ...base, isActive: true, priority: 'URGENTE', abogadoId: auth.uid };
    const normalWhere: any =
      auth.role === 'ADMIN'
        ? { ...base, isActive: true, priority: 'NORMAL' }
        : { ...base, isActive: true, priority: 'NORMAL', abogadoId: auth.uid };
    const [total, urgentTotal, normalTotal, cases] = await Promise.all([
      prisma.legalCase.count({ where }),
      prisma.legalCase.count({ where: urgentWhere }),
      prisma.legalCase.count({ where: normalWhere }),
      prisma.legalCase.findMany({
        where,
        select: {
          id: true,
          type: true,
          matter: true,
          expediente: true,
          priority: true,
          status: true,
          updatedAt: true,
          createdAt: true,
          context: true,
          notes: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: ps
      })
    ]);
    // Resolve último paso (concepto) por expediente
    const results: Array<{ caseId: string; concept: string | null }> = [];
    for (const c of cases) {
      let row: Array<{ concept: string | null }> = [];
      try {
        row = await prisma.$queryRawUnsafe<Array<{ concept: string | null }>>(
          `SELECT "concept" FROM "CaseAttachment" WHERE "caseId" = $1 AND "concept" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`,
          c.id
        );
      } catch {
        row = [];
      }
      results.push({ caseId: c.id, concept: row?.[0]?.concept || null });
    }
    const courtInfo: Array<{ caseId: string; cn: string | null; ct: string | null }> = [];
    for (const c of cases) {
      try {
        const row = await prisma.$queryRawUnsafe<Array<{ courtNumber: string | null; courtType: string | null }>>(
          `SELECT "courtNumber","courtType" FROM "LegalCase" WHERE "id" = $1`,
          c.id
        );
        courtInfo.push({ caseId: c.id, cn: row?.[0]?.courtNumber || null, ct: row?.[0]?.courtType || null });
      } catch {
        courtInfo.push({ caseId: c.id, cn: null, ct: null });
      }
    }
    const hydrated = cases.map(c => {
      const lc = results.find(r => r.caseId === c.id)?.concept || null;
      const ci = courtInfo.find(r => r.caseId === c.id);
      const court = [ci?.ct || '', ci?.cn || ''].filter(Boolean).join(' ').trim() || null;
      return { ...c, lastConcept: lc, court };
    });
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ cases: hydrated, total, urgentTotal, normalTotal, page: p, pageSize: ps });
  }

  if (req.method === 'PUT') {
    const { id, priority, status, notes, client } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.legalCase.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    if (!canAccessLegalCase(auth, before)) return res.status(404).json({ error: 'No encontrado' });
    const updated = await prisma.legalCase.update({
      where: { id },
      data: {
        priority: priority ? String(priority) : before.priority,
        status: status ? String(status) : before.status,
        notes: notes !== undefined ? String(notes) : before.notes
      }
    });
    if (auth.role === 'ADMIN' && client && before.clientId) {
      await prisma.client.update({
        where: { id: before.clientId },
        data: {
          name: client.name ? String(client.name) : undefined,
          phone: client.phone ? String(client.phone) : undefined,
          email: client.email ? String(client.email) : undefined,
          address: client.address ? String(client.address) : undefined
        }
      });
    }
    if (status && status !== before.status) {
      await prisma.caseEvent.create({
        data: { caseId: id, type: 'STATUS', from: before.status, to: String(status) }
      });
    }
    if (priority && priority !== before.priority) {
      await prisma.caseEvent.create({
        data: { caseId: id, type: 'PRIORITY', from: before.priority, to: String(priority) }
      });
    }
    if (notes && notes !== before.notes) {
      await prisma.caseEvent.create({
        data: { caseId: id, type: 'NOTE', message: String(notes) }
      });
    }
    return res.status(200).json({ id: updated.id });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.legalCase.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    if (!canAccessLegalCase(auth, before)) return res.status(404).json({ error: 'No encontrado' });
    await prisma.legalCase.update({ where: { id }, data: { isActive: false, status: 'BAJA' } });
    await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', message: 'Baja lógica (isActive=false)' } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
