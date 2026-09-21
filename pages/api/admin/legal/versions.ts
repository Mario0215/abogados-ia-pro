import type { NextApiRequest, NextApiResponse } from 'next';
import { LegalNormVersionStatus } from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import {
  createDraftLegalNormVersion,
  createDraftLegalNormVersionFromSource,
  publishLegalNormVersion,
  queueLegalVersionReindex,
  replaceDraftLegalProvisionStructure,
  retireLegalNormVersion
} from '../../../../lib/legal/governance';
import { previewLegalStructure } from '../../../../lib/legal/structure-preview';
import { prisma } from '../../../../lib/prisma';

function isAdmin(req: NextApiRequest): boolean {
  return getAuthFromCookies(req.headers.cookie)?.role === 'ADMIN';
}

function optionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Fecha inválida.');
  return parsed;
}

function apiError(res: NextApiResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'No se pudo completar la operación normativa.';
  return res.status(message.includes('no encontrada') ? 404 : 400).json({ error: message });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const normId = typeof req.query.normId === 'string' ? req.query.normId : undefined;
    const versions = await prisma.legalNormVersion.findMany({
      where: normId ? { normId } : undefined,
      include: {
        norm: true,
        source: {
          select: {
            id: true,
            authority: true,
            status: true,
            targetNormId: true,
            originalFileName: true,
            originalSha256: true,
            extractionStatus: true,
            extractedTextHash: true,
            extractedAt: true
          }
        },
        _count: { select: { provisions: true } }
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100
    });
    return res.status(200).json({ versions });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body ?? {};
  try {
    if (action === 'preview') {
      const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
      if (!rawText.trim() || rawText.length > 3_000_000) return res.status(400).json({ error: 'El texto de previsualización es requerido y no puede exceder 3 MB.' });
      return res.status(200).json({ preview: previewLegalStructure(rawText) });
    }

    if (action === 'previewSource') {
      const { sourceId } = req.body ?? {};
      if (typeof sourceId !== 'string') return res.status(400).json({ error: 'Fuente requerida.' });
      const source = await prisma.legalSource.findUnique({
        where: { id: sourceId },
        select: { extractionStatus: true, extractedText: true, extractedTextHash: true, targetNormId: true }
      });
      if (!source) return res.status(404).json({ error: 'Fuente no encontrada.' });
      if (source.extractionStatus !== 'EXTRACTED' || !source.extractedText || !source.extractedTextHash) {
        return res.status(409).json({ error: 'La fuente no tiene texto extraído verificable para previsualizar.' });
      }
      return res.status(200).json({ preview: previewLegalStructure(source.extractedText), targetNormId: source.targetNormId });
    }

    if (action === 'draft') {
      const { normId, versionKey, publicationDate, effectiveFrom, effectiveTo, sourceId, contentHash, previousVersionId, notes } = req.body ?? {};
      if (typeof normId !== 'string' || typeof versionKey !== 'string' || !versionKey.trim()) {
        return res.status(400).json({ error: 'Norma y clave de versión son requeridas.' });
      }
      if (typeof sourceId === 'string' && sourceId) {
        const source = await prisma.legalSource.findUnique({ where: { id: sourceId }, select: { targetNormId: true } });
        if (!source) return res.status(404).json({ error: 'Fuente no encontrada.' });
        if (source.targetNormId && source.targetNormId !== normId) {
          return res.status(409).json({ error: 'La fuente seleccionada pertenece a otra norma y no puede mezclarse con esta versión.' });
        }
      }
      const response = await createDraftLegalNormVersion(prisma, {
        normId,
        versionKey,
        publicationDate: optionalDate(publicationDate),
        effectiveFrom: optionalDate(effectiveFrom),
        effectiveTo: optionalDate(effectiveTo),
        sourceId: typeof sourceId === 'string' && sourceId ? sourceId : null,
        contentHash: typeof contentHash === 'string' && contentHash ? contentHash : null,
        previousVersionId: typeof previousVersionId === 'string' && previousVersionId ? previousVersionId : null,
        notes: typeof notes === 'string' ? notes : null
      });
      return res.status(response.created ? 201 : 200).json(response);
    }

    if (action === 'draftFromSource') {
      const { normId, sourceId, versionKey, publicationDate, effectiveFrom, effectiveTo, previousVersionId, notes } = req.body ?? {};
      if (typeof normId !== 'string' || typeof sourceId !== 'string' || typeof versionKey !== 'string' || !versionKey.trim()) {
        return res.status(400).json({ error: 'Norma, fuente y clave de versión son requeridas.' });
      }
      const response = await createDraftLegalNormVersionFromSource(prisma, {
        normId,
        sourceId,
        versionKey,
        publicationDate: optionalDate(publicationDate),
        effectiveFrom: optionalDate(effectiveFrom),
        effectiveTo: optionalDate(effectiveTo),
        previousVersionId: typeof previousVersionId === 'string' && previousVersionId ? previousVersionId : null,
        notes: typeof notes === 'string' ? notes : null
      });
      return res.status(response.created ? 201 : 200).json(response);
    }

    if (action === 'startReview') {
      const { versionId } = req.body ?? {};
      if (typeof versionId !== 'string') return res.status(400).json({ error: 'Versión requerida.' });
      const version = await prisma.legalNormVersion.findUnique({
        where: { id: versionId },
        include: { source: true, _count: { select: { provisions: true } } }
      });
      if (!version || version.status !== LegalNormVersionStatus.DRAFT) return res.status(409).json({ error: 'Sólo una versión DRAFT puede pasar a revisión.' });
      if (!version.sourceId || !version.contentHash || version._count.provisions === 0) {
        return res.status(409).json({ error: 'La versión requiere fuente, hash y estructura antes de pasar a revisión.' });
      }
      await prisma.legalNormVersion.update({ where: { id: versionId }, data: { status: LegalNormVersionStatus.UNDER_REVIEW } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'importStructure') {
      const { versionId, rawText } = req.body ?? {};
      if (typeof versionId !== 'string' || typeof rawText !== 'string' || !rawText.trim() || rawText.length > 3_000_000) {
        return res.status(400).json({ error: 'Versión y texto estructurado válido son requeridos.' });
      }
      const result = await replaceDraftLegalProvisionStructure(prisma, versionId, rawText);
      return res.status(200).json({ result });
    }

    if (action === 'publish') {
      const { versionId, status } = req.body ?? {};
      if (typeof versionId !== 'string' || (status !== undefined && !['PUBLISHED', 'CURRENT', 'FUTURE'].includes(status))) {
        return res.status(400).json({ error: 'Versión o estado de publicación inválido.' });
      }
      const version = await publishLegalNormVersion(prisma, versionId, { status });
      return res.status(200).json({ version });
    }

    if (action === 'reindex') {
      const { versionId, model } = req.body ?? {};
      if (typeof versionId !== 'string') return res.status(400).json({ error: 'Versión requerida.' });
      const result = await queueLegalVersionReindex(prisma, versionId, typeof model === 'string' && model ? model : undefined);
      return res.status(200).json({ result, message: 'Se dejaron embeddings en cola PENDING; este endpoint no llama a IA.' });
    }

    if (action === 'retire') {
      const { versionId, reason, status } = req.body ?? {};
      if (typeof versionId !== 'string' || typeof reason !== 'string' || !reason.trim() || (status !== undefined && !['REPEALED', 'HISTORICAL'].includes(status))) {
        return res.status(400).json({ error: 'Versión, motivo y estado de retiro válidos son requeridos.' });
      }
      const version = await retireLegalNormVersion(prisma, versionId, { reason, status });
      return res.status(200).json({ version });
    }
    return res.status(400).json({ error: 'Acción normativa no reconocida.' });
  } catch (error) {
    return apiError(res, error);
  }
}
