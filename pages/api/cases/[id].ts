import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth) return res.status(403).json({ error: 'No autorizado' });
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'ID requerido' });

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
    if (t.includes('divorcio') && t.includes('adulterio')) return 'DIVORCIO_ADULTERIO';
    if (t.includes('divorcio') && t.includes('abandono')) return 'DIVORCIO_ABANDONO';
    if ((t.includes('resolución') || t.includes('resolucion')) && (t.includes('compra venta') || t.includes('compraventa')) && (t.includes('incumplimiento') || t.includes('entrega'))) return 'RESOLUCION_CV_INC_ENTREGA';
    if (t.includes('cancelación') || t.includes('cancelacion')) return 'CANCELACION_CONTRATO';
    if (t.includes('divorcio')) return 'DIVORCIO';
    return null;
  }

  if (req.method === 'GET') {
    const lc = await prisma.legalCase.findUnique({
      where: { id },
      include: {
        client: true,
        attachments: true,
        events: true,
        knowledge: { include: { document: true }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (!canAccessLegalCase(auth, lc)) return res.status(404).json({ error: 'No encontrado' });
    let courtNumber: string | null = null;
    let courtType: string | null = null;
    let counterpartyAddress: string | null = null;
    let facts: string | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ courtNumber: string | null; courtType: string | null; counterpartyAddress: string | null; facts: string | null }>>(
        `SELECT "courtNumber","courtType","counterpartyAddress","facts" FROM "LegalCase" WHERE "id" = $1`,
        id
      );
      courtNumber = rows?.[0]?.courtNumber || null;
      courtType = rows?.[0]?.courtType || null;
      counterpartyAddress = rows?.[0]?.counterpartyAddress || null;
      facts = rows?.[0]?.facts || null;
    } catch {}
    return res.status(200).json({ case: { ...lc, courtNumber, courtType, counterpartyAddress, facts } });
  }

  if (req.method === 'PUT') {
    const { priority, status, matter, counterparty, counterpartyAddress, notes, facts, client, fee, context, party, intent, regenerate, expedienteReal, generateFolio, expediente, courtNumber, courtType } = req.body || {};
    const before = await prisma.legalCase.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    if (!canAccessLegalCase(auth, before)) return res.status(404).json({ error: 'No encontrado' });
    let updated = await prisma.legalCase.update({
      where: { id },
      data: {
        priority: priority ? String(priority) : before.priority,
        status: status ? String(status) : before.status,
        matter: matter ? String(matter) : before.matter,
        counterparty: counterparty ? String(counterparty) : before.counterparty,
        notes: notes !== undefined ? String(notes) : before.notes,
        fee: auth.role === 'ADMIN' ? (fee !== undefined ? Number(fee) : before.fee) : before.fee,
        context: context !== undefined ? String(context) : before.context,
        party: party ? String(party) : before.party,
        intent: intent !== undefined ? String(intent) : before.intent,
        expediente: expediente ? String(expediente) : before.expediente,
        claimKey: intent !== undefined ? claimKeyFromIntent(String(intent)) : before.claimKey
      }
    });
    if (facts !== undefined && String(facts) !== String(((before as any).facts || ''))) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "facts" = $1 WHERE "id" = $2`, String(facts), id);
      } catch {}
    }
    if (courtNumber !== undefined && String(courtNumber) !== String(((before as any).courtNumber || ''))) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "courtNumber" = $1 WHERE "id" = $2`, String(courtNumber), id);
      } catch {}
    }
    if (courtType !== undefined && String(courtType) !== String(((before as any).courtType || ''))) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "courtType" = $1 WHERE "id" = $2`, String(courtType), id);
      } catch {}
    }
    if (counterpartyAddress !== undefined) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "counterpartyAddress" = $1 WHERE "id" = $2`, counterpartyAddress ? String(counterpartyAddress) : null, id);
      } catch {}
    }
    let effExpedienteReal: string | null | undefined = undefined;
    let effFolioProvisional: string | null | undefined = undefined;
    if (typeof expedienteReal === 'string' && expedienteReal !== String(((before as any)?.expedienteReal || ''))) {
      effExpedienteReal = String(expedienteReal);
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "expedienteReal" = $1 WHERE "id" = $2`, effExpedienteReal, id);
      } catch {}
      await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', message: `Expediente real: ${String(expedienteReal)}` } });
    }
    if (generateFolio === true && !((before as any)?.folioProvisional)) {
      let existing: Array<{ fp: string | null }> = [];
      try {
        existing = await prisma.$queryRawUnsafe<Array<{ fp: string | null }>>(
          `SELECT "folioProvisional" AS fp FROM "LegalCase" WHERE "userId" = $1 AND "folioProvisional" IS NOT NULL`,
          (before as any).userId
        );
      } catch {
        existing = [];
      }
      let maxNum = 0;
      for (const r of existing) {
        const m = String(r.fp || '').match(/PROV-(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      }
      const next = maxNum + 1;
      const folio = `PROV-${String(next).padStart(3, '0')}`;
      effFolioProvisional = folio;
      try {
        await prisma.$executeRawUnsafe(`UPDATE "LegalCase" SET "folioProvisional" = $1 WHERE "id" = $2`, folio, id);
      } catch {}
      await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', message: `Folio provisional asignado: ${folio}` } });
    }
    if (client && before.clientId) {
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
      await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', from: before.status, to: String(status) } });
    }
    if (priority && priority !== before.priority) {
      await prisma.caseEvent.create({ data: { caseId: id, type: 'PRIORITY', from: before.priority, to: String(priority) } });
    }
    if (matter && matter !== before.matter) {
      await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', message: `Materia: ${before.matter} → ${String(matter)}` } });
    }
    if (fee !== undefined && fee !== before.fee) {
      await prisma.caseEvent.create({ data: { caseId: id, type: 'FEE', message: 'Honorarios actualizados' } });
    }
    if (context && context !== before.context) {
      await prisma.caseEvent.create({ data: { caseId: id, type: 'CONTEXT', message: 'Contexto actualizado' } });
    }
    if ((intent !== undefined && String(intent) !== (before.intent || '')) || regenerate === true) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "CaseKnowledge" WHERE "caseId" = $1`, id);
        const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
        const basis = intent !== undefined ? String(intent) : (before.intent || '');
        if (apiKey && String(basis).trim().length > 0) {
          const vec = await embedQuery(apiKey, String(basis));
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
          for (const r of toInsert) {
            try {
              await prisma.$executeRawUnsafe(
                `INSERT INTO "CaseKnowledge" ("id","caseId","documentId","sourceType","snippet","score") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
                `${id}-${r.id}`, id, r.id, (r as any).sourceType || null, String(r.content || '').slice(0, 800), Number((r as any).score) || null
              );
            } catch {}
          }
        }
      } catch (e) {
        process.stderr.write(`re-prefetch error: ${String((e as any)?.message || e)}\n`);
      }
    }
    return res.status(200).json({ id: updated.id, expedienteReal: effExpedienteReal ?? null, folioProvisional: effFolioProvisional ?? null });
  }

  if (req.method === 'DELETE') {
    const before = await prisma.legalCase.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    if (!canAccessLegalCase(auth, before)) return res.status(404).json({ error: 'No encontrado' });
    await prisma.legalCase.update({ where: { id }, data: { isActive: false, status: 'BAJA' } });
    await prisma.caseEvent.create({ data: { caseId: id, type: 'STATUS', message: 'Baja lógica (isActive=false)' } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
