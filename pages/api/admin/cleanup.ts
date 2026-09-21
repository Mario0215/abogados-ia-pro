import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

function numFromTitle(title: string): string | null {
  const m = String(title || '').match(/Artículo\s+(\d+)/i);
  return m ? m[1] : null;
}

async function reassignFederalCNPCF() {
  const n = await prisma.$executeRawUnsafe<number>(`
    UPDATE "Document"
    SET "sourceType"='CNPCF'
    WHERE "jurisdiccion"='FEDERAL'
      AND "matter"='CIVIL'
      AND "submatter"='Procesal/Adjetivo'
      AND COALESCE("sourceType",'')<>'CNPCF'
  `);
  return typeof n === 'number' ? n : 0;
}

async function dedupCPCKeepLatest() {
  const rows: Array<{ id: string; title: string; updatedAt: Date }> = await prisma.$queryRawUnsafe(`
    SELECT "id","title","updatedAt" FROM "Document" WHERE "sourceType"='CPC'
  `);
  const latest = new Map<string, { id: string; ts: number }>();
  const toDelete: string[] = [];
  for (const r of rows) {
    const num = numFromTitle(r.title) || 'PRE';
    const ts = new Date(r.updatedAt).getTime();
    const prev = latest.get(num);
    if (!prev || ts > prev.ts) {
      if (prev) toDelete.push(prev.id);
      latest.set(num, { id: r.id, ts });
    } else {
      toDelete.push(r.id);
    }
  }
  if (toDelete.length > 0) {
    await prisma.document.deleteMany({ where: { id: { in: toDelete } } });
  }
  return { deleted: toDelete.length, kept: latest.size };
}

async function uniqueCount(sourceType: 'CC' | 'CPC' | 'CNPCF', stateName?: string) {
  const rows: Array<{ title: string }> = await prisma.$queryRawUnsafe(
    `
    SELECT d."title"
    FROM "Document" d
    LEFT JOIN "State" s ON d."stateId"=s."id"
    WHERE d."sourceType"=$1 ${stateName ? `AND s."name"=$2` : ``}
    `,
    sourceType, stateName || undefined
  );
  const set = new Set<string>();
  for (const r of rows) {
    const num = numFromTitle(r.title);
    if (num) set.add(num);
  }
  return set.size;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'POST') {
    const reassigned = await reassignFederalCNPCF();
    const dedup = await dedupCPCKeepLatest();
    const cc = await uniqueCount('CC', 'Guanajuato');
    const cpc = await uniqueCount('CPC', 'Guanajuato');
    const cnpcf = await uniqueCount('CNPCF');
    return res.status(200).json({
      ok: true,
      reassignedCNPCF: reassigned,
      deduplicateCPC: dedup,
      counts: { CC_GTO: cc, CPC_GTO: cpc, CNPCF: cnpcf }
    });
  }

  if (req.method === 'GET') {
    const cc = await uniqueCount('CC', 'Guanajuato');
    const cpc = await uniqueCount('CPC', 'Guanajuato');
    const cnpcf = await uniqueCount('CNPCF');
    return res.status(200).json({ counts: { CC_GTO: cc, CPC_GTO: cpc, CNPCF: cnpcf } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
