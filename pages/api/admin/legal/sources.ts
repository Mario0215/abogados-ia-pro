import type { NextApiRequest, NextApiResponse } from 'next';
import { LegalSourceExtractionStatus, LegalSourceStatus, LegalSourceTrustLevel } from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import { upsertLegalSource } from '../../../../lib/legal/governance';
import { isLegalSourceTrustLevel } from '../../../../lib/legal/constants';
import { prisma } from '../../../../lib/prisma';

function isAdmin(req: NextApiRequest): boolean {
  return getAuthFromCookies(req.headers.cookie)?.role === 'ADMIN';
}

function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const sources = await prisma.legalSource.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        fingerprint: true,
        authority: true,
        url: true,
        trustLevel: true,
        capturedAt: true,
        contentHash: true,
        originFile: true,
        targetNormId: true,
        originalFileName: true,
        originalMimeType: true,
        originalStorageProvider: true,
        originalStoragePath: true,
        originalSizeBytes: true,
        originalSha256: true,
        extractionStatus: true,
        extractedTextHash: true,
        structuredHash: true,
        extractionEngine: true,
        extractionMetadata: true,
        extractionError: true,
        extractedAt: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        targetNorm: { select: { id: true, canonicalId: true, officialName: true, matter: true } },
        _count: { select: { normVersions: true, applicabilityRules: true, transitionRules: true } }
      }
    });
    return res.status(200).json({ sources });
  }

  if (req.method === 'POST') {
    const { authority, url, trustLevel, capturedAt, contentHash, originFile, notes } = req.body ?? {};
    if (typeof authority !== 'string' || authority.trim().length < 3 || !validUrl(url) || !isLegalSourceTrustLevel(trustLevel)) {
      return res.status(400).json({ error: 'Autoridad, URL válida y nivel de confianza son requeridos.' });
    }
    const parsedCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
    if (Number.isNaN(parsedCapturedAt.getTime())) return res.status(400).json({ error: 'Fecha de captura inválida.' });
    const source = await upsertLegalSource(prisma, {
      authority,
      url,
      trustLevel: trustLevel as LegalSourceTrustLevel,
      capturedAt: parsedCapturedAt,
      contentHash: typeof contentHash === 'string' ? contentHash : null,
      originFile: typeof originFile === 'string' ? originFile : null,
      notes: typeof notes === 'string' ? notes : null
    });
    return res.status(201).json({ source, message: 'Fuente registrada en borrador. Actívala después de verificarla.' });
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body ?? {};
    if (typeof id !== 'string' || !Object.values(LegalSourceStatus).includes(status)) {
      return res.status(400).json({ error: 'ID o estado de fuente inválido.' });
    }
    if (status === LegalSourceStatus.ACTIVE) {
      const sourceToActivate = await prisma.legalSource.findUnique({
        where: { id },
        select: {
          targetNormId: true,
          originalFileName: true,
          originalSha256: true,
          originalStoragePath: true,
          originalFileData: true,
          extractionStatus: true,
          extractedTextHash: true
        }
      });
      if (!sourceToActivate) return res.status(404).json({ error: 'Fuente no encontrada.' });
      const isPdfWorkflow = Boolean(sourceToActivate.targetNormId || sourceToActivate.originalFileName);
      if (isPdfWorkflow && (
        !sourceToActivate.originalFileName
        || !sourceToActivate.originalSha256
        || (!sourceToActivate.originalStoragePath && !sourceToActivate.originalFileData)
        || sourceToActivate.extractionStatus !== LegalSourceExtractionStatus.EXTRACTED
        || !sourceToActivate.extractedTextHash
      )) {
        return res.status(409).json({ error: 'La fuente PDF debe conservar su original y texto extraído verificable antes de activarse.' });
      }
    }
    const source = await prisma.legalSource.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true }
    });
    return res.status(200).json({ source });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
