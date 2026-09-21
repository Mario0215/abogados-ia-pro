import type { NextApiRequest, NextApiResponse } from 'next';
import { LegalScope } from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import {
  INITIAL_LEGAL_NORM_CATALOG,
  isSupportedLegalMatter,
  type SupportedLegalMatter
} from '../../../../lib/legal/constants';
import { ensureInitialLegalNormCatalog } from '../../../../lib/legal/governance';
import { prisma } from '../../../../lib/prisma';

function isAdmin(req: NextApiRequest): boolean {
  return getAuthFromCookies(req.headers.cookie)?.role === 'ADMIN';
}

function normalizeMatters(value: unknown, primaryMatter: SupportedLegalMatter): SupportedLegalMatter[] | null {
  const values = Array.isArray(value) ? value : [primaryMatter];
  const matters = [...new Set(values.filter(isSupportedLegalMatter))];
  if (!matters.length || !matters.includes(primaryMatter) || matters.length !== values.length) return null;
  return matters;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const norms = await prisma.legalNorm.findMany({
      include: { matters: true, _count: { select: { versions: true } } },
      orderBy: { canonicalId: 'asc' }
    });
    return res.status(200).json({ norms, initialCatalog: INITIAL_LEGAL_NORM_CATALOG });
  }

  if (req.method === 'POST') {
    if (req.body?.action === 'seedInitialCatalog') {
      const catalog = await ensureInitialLegalNormCatalog(prisma);
      return res.status(200).json({ catalog, message: 'Catálogo sincronizado sin textos ni versiones normativas.' });
    }
    const { canonicalId, officialName, matter, matters, scope, issuingAuthority } = req.body ?? {};
    const normalizedCanonicalId = typeof canonicalId === 'string' ? canonicalId.trim().toUpperCase() : '';
    if (!/^[A-Z0-9_]{2,80}$/.test(normalizedCanonicalId) || typeof officialName !== 'string' || officialName.trim().length < 3 || !isSupportedLegalMatter(matter) || !Object.values(LegalScope).includes(scope) || typeof issuingAuthority !== 'string' || issuingAuthority.trim().length < 3) {
      return res.status(400).json({ error: 'Datos de norma inválidos o fuera del alcance permitido.' });
    }
    const normalizedMatters = normalizeMatters(matters, matter);
    if (!normalizedMatters) return res.status(400).json({ error: 'La norma debe tener únicamente materias habilitadas e incluir su materia principal.' });
    const exists = await prisma.legalNorm.findUnique({ where: { canonicalId: normalizedCanonicalId } });
    if (exists) return res.status(409).json({ error: 'El identificador canónico ya existe.' });
    const norm = await prisma.legalNorm.create({
      data: {
        canonicalId: normalizedCanonicalId,
        officialName: officialName.trim(),
        matter,
        scope,
        issuingAuthority: issuingAuthority.trim(),
        matters: { create: normalizedMatters.map((legalMatter) => ({ matter: legalMatter })) }
      },
      include: { matters: true }
    });
    return res.status(201).json({ norm });
  }

  if (req.method === 'PATCH') {
    const { id, active } = req.body ?? {};
    if (typeof id !== 'string' || typeof active !== 'boolean') return res.status(400).json({ error: 'Datos inválidos.' });
    const norm = await prisma.legalNorm.update({ where: { id }, data: { active } });
    return res.status(200).json({ norm });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
