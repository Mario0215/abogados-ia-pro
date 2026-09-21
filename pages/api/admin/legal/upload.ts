import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { LegalSourceExtractionStatus, LegalSourceStatus, LegalSourceTrustLevel } from '@prisma/client';
import { getAuthFromCookies } from '../../../../lib/auth';
import { isLegalSourceTrustLevel } from '../../../../lib/legal/constants';
import { legalSourceFingerprint } from '../../../../lib/legal/governance';
import { extractLegalPdf } from '../../../../lib/legal/pdf-extractor';
import { persistLegalSourceOriginal, MAX_LEGAL_PDF_BYTES } from '../../../../lib/legal/source-storage';
import { previewLegalStructure } from '../../../../lib/legal/structure-preview';
import { prisma } from '../../../../lib/prisma';

export const config = {
  api: { bodyParser: false }
};

type UploadedFile = {
  filepath: string;
  originalFilename?: string | null;
  mimetype?: string | null;
};

function isAdmin(req: NextApiRequest): boolean {
  return getAuthFromCookies(req.headers.cookie)?.role === 'ADMIN';
}

function fieldValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function validUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function fileName(value: string | null | undefined): string {
  const normalized = String(value || 'fuente-oficial.pdf').trim().replace(/[\\/]/g, '-');
  return normalized || 'fuente-oficial.pdf';
}

function isPdf(buffer: Buffer, name: string, mimeType: string | null | undefined): boolean {
  return name.toLowerCase().endsWith('.pdf')
    && (mimeType === 'application/pdf' || !mimeType || mimeType === 'application/octet-stream')
    && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function sourceSummary(source: any) {
  return {
    id: source.id,
    authority: source.authority,
    url: source.url,
    trustLevel: source.trustLevel,
    capturedAt: source.capturedAt,
    status: source.status,
    targetNormId: source.targetNormId,
    originalFileName: source.originalFileName,
    originalMimeType: source.originalMimeType,
    originalStorageProvider: source.originalStorageProvider,
    originalSizeBytes: source.originalSizeBytes,
    originalSha256: source.originalSha256,
    extractionStatus: source.extractionStatus,
    extractedTextHash: source.extractedTextHash,
    structuredHash: source.structuredHash,
    extractionEngine: source.extractionEngine,
    extractionMetadata: source.extractionMetadata,
    extractionError: source.extractionError,
    extractedAt: source.extractedAt
  };
}

function previewSummaryFromStructure(preview: ReturnType<typeof previewLegalStructure>) {
  const provisions = preview.provisions;
  return {
    sourceHash: preview.sourceHash,
    count: provisions.length,
    articleCount: provisions.filter((provision) => provision.type === 'ARTICLE').length,
    warnings: preview.warnings,
    provisions: provisions.slice(0, 40).map((provision) => ({
      type: provision.type,
      designation: provision.designation,
      heading: provision.heading,
      structurePath: provision.structurePath
    }))
  };
}

function previewSummary(extraction: Awaited<ReturnType<typeof extractLegalPdf>>) {
  return previewSummaryFromStructure(extraction.preview);
}

async function parseUpload(req: NextApiRequest) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_LEGAL_PDF_BYTES,
    maxTotalFileSize: MAX_LEGAL_PDF_BYTES,
    allowEmptyFiles: false,
    minFileSize: 1,
    keepExtensions: true
  });
  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uploaded: UploadedFile | null = null;
  try {
    const { fields, files } = await parseUpload(req);
    const candidate = files.file;
    uploaded = (Array.isArray(candidate) ? candidate[0] : candidate) as UploadedFile | undefined ?? null;
    if (!uploaded?.filepath) return res.status(400).json({ error: 'Selecciona un PDF oficial.' });

    const authority = fieldValue(fields.authority).trim();
    const url = fieldValue(fields.url).trim();
    const normId = fieldValue(fields.normId).trim();
    const trustLevel = fieldValue(fields.trustLevel || 'PRIMARY_OFFICIAL').trim();
    const capturedAtRaw = fieldValue(fields.capturedAt).trim();
    const notes = fieldValue(fields.notes).trim();
    const reprocess = fieldValue(fields.reprocess).trim() === 'true';
    const parsedCapturedAt = capturedAtRaw ? new Date(capturedAtRaw) : new Date();

    if (authority.length < 3 || !validUrl(url) || !normId || !isLegalSourceTrustLevel(trustLevel)) {
      return res.status(400).json({ error: 'Norma, autoridad, URL oficial válida y nivel de confianza son requeridos.' });
    }
    if (Number.isNaN(parsedCapturedAt.getTime())) return res.status(400).json({ error: 'Fecha de consulta inválida.' });

    const norm = await prisma.legalNorm.findFirst({
      where: { id: normId, active: true },
      select: { id: true, canonicalId: true, matter: true }
    });
    if (!norm) return res.status(404).json({ error: 'La norma seleccionada no está disponible en el catálogo jurídico habilitado.' });

    const buffer = await readFile(uploaded.filepath);
    const originalName = fileName(uploaded.originalFilename);
    if (buffer.length > MAX_LEGAL_PDF_BYTES) return res.status(413).json({ error: 'El PDF excede el límite de 25 MB.' });
    if (!isPdf(buffer, originalName, uploaded.mimetype)) {
      return res.status(400).json({ error: 'Sólo se aceptan archivos PDF válidos con firma PDF.' });
    }

    const originalSha256 = hashBuffer(buffer);
    const fingerprint = legalSourceFingerprint({ authority, url, contentHash: originalSha256, originFile: originalName });
    const existing = await prisma.legalSource.findUnique({ where: { fingerprint } });
    if (existing) {
      if (existing.targetNormId && existing.targetNormId !== norm.id) {
        return res.status(409).json({ error: 'El PDF ya está ligado a otra norma y no puede reutilizarse en una materia o versión distinta.' });
      }
      if (existing.extractionStatus === LegalSourceExtractionStatus.EXTRACTED && !reprocess) {
        const preview = existing.extractedText ? previewSummaryFromStructure(previewLegalStructure(existing.extractedText)) : undefined;
        return res.status(200).json({
          source: sourceSummary(existing),
          norm: { id: norm.id, canonicalId: norm.canonicalId, matter: norm.matter },
          preview,
          deduplicated: true,
          message: 'El mismo PDF oficial ya está conservado como fuente. Se recuperó su previsualización sin crear una copia adicional.'
        });
      }
      try {
        const extraction = await extractLegalPdf(buffer);
        const extracted = await prisma.legalSource.update({
          where: { id: existing.id },
          data: {
            extractionStatus: LegalSourceExtractionStatus.EXTRACTED,
            extractedText: extraction.text,
            extractedTextHash: extraction.textHash,
            structuredMarkdown: extraction.structuredMarkdown,
            structuredHash: extraction.structuredHash,
            extractionEngine: 'pdfjs-dist/6.3.289',
            extractionMetadata: {
              pageCount: extraction.pageCount,
              provisionCount: extraction.preview.provisions.length,
              articleCount: extraction.preview.provisions.filter((provision) => provision.type === 'ARTICLE').length,
              warnings: extraction.preview.warnings
            },
            extractionError: null,
            extractedAt: new Date()
          }
        });
        return res.status(200).json({
          source: sourceSummary(extracted),
          norm: { id: norm.id, canonicalId: norm.canonicalId, matter: norm.matter },
          preview: previewSummary(extraction),
          deduplicated: true,
          message: 'Se reprocesó el PDF original ya conservado. La fuente y cualquier versión permanecen en DRAFT.'
        });
      } catch (error) {
        const requiresOcr = error instanceof Error && error.message === 'OCR_REQUIRED';
        const message = requiresOcr
          ? 'El PDF no contiene una capa de texto suficiente. El original se conservó y requiere OCR o revisión humana.'
          : 'El PDF original sigue conservado, pero no se pudo extraer su texto para estructurarlo.';
        const failed = await prisma.legalSource.update({
          where: { id: existing.id },
          data: {
            extractionStatus: requiresOcr ? LegalSourceExtractionStatus.REQUIRES_OCR : LegalSourceExtractionStatus.FAILED,
            extractionEngine: 'pdfjs-dist/6.3.289',
            extractionError: message
          }
        });
        return res.status(200).json({ source: sourceSummary(failed), norm, deduplicated: true, message });
      }
    }

    const source = await prisma.legalSource.create({
      data: {
        fingerprint,
        authority,
        url,
        trustLevel: trustLevel as LegalSourceTrustLevel,
        capturedAt: parsedCapturedAt,
        contentHash: originalSha256,
        originFile: originalName,
        targetNormId: norm.id,
        notes: notes || null,
        status: LegalSourceStatus.DRAFT,
        extractionStatus: LegalSourceExtractionStatus.PENDING
      }
    });

    try {
      const persisted = await persistLegalSourceOriginal({ sourceId: source.id, originalName, buffer });
      await prisma.legalSource.update({
        where: { id: source.id },
        data: {
          originalFileName: originalName,
          originalMimeType: 'application/pdf',
          originalStorageProvider: persisted.provider,
          originalStoragePath: persisted.storagePath,
          originalFileData: persisted.databaseData,
          originalSizeBytes: buffer.length,
          originalSha256
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo conservar el PDF original.';
      const failed = await prisma.legalSource.update({
        where: { id: source.id },
        data: { extractionStatus: LegalSourceExtractionStatus.FAILED, extractionError: message }
      });
      return res.status(503).json({ source: sourceSummary(failed), error: message });
    }

    try {
      const extraction = await extractLegalPdf(buffer);
      const extracted = await prisma.legalSource.update({
        where: { id: source.id },
        data: {
          extractionStatus: LegalSourceExtractionStatus.EXTRACTED,
          extractedText: extraction.text,
          extractedTextHash: extraction.textHash,
          structuredMarkdown: extraction.structuredMarkdown,
          structuredHash: extraction.structuredHash,
          extractionEngine: 'pdfjs-dist/6.3.289',
          extractionMetadata: {
            pageCount: extraction.pageCount,
            provisionCount: extraction.preview.provisions.length,
            articleCount: extraction.preview.provisions.filter((provision) => provision.type === 'ARTICLE').length,
            warnings: extraction.preview.warnings
          },
          extractionError: null,
          extractedAt: new Date()
        }
      });
      return res.status(201).json({
        source: sourceSummary(extracted),
        norm: { id: norm.id, canonicalId: norm.canonicalId, matter: norm.matter },
        preview: previewSummary(extraction),
        message: 'PDF original conservado y estructura previsualizada. La fuente y cualquier versión permanecen en DRAFT.'
      });
    } catch (error) {
      const requiresOcr = error instanceof Error && error.message === 'OCR_REQUIRED';
      const message = requiresOcr
        ? 'El PDF no contiene una capa de texto suficiente. El original se conservó y requiere OCR o revisión humana.'
        : 'El PDF original se conservó, pero no se pudo extraer su texto para estructurarlo.';
      const failed = await prisma.legalSource.update({
        where: { id: source.id },
        data: {
          extractionStatus: requiresOcr ? LegalSourceExtractionStatus.REQUIRES_OCR : LegalSourceExtractionStatus.FAILED,
          extractionEngine: 'pdfjs-dist/6.3.289',
          extractionError: message
        }
      });
      return res.status(201).json({ source: sourceSummary(failed), norm, message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el PDF.';
    const tooLarge = /maxFileSize|maxTotalFileSize|larger than/i.test(message);
    return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'El PDF excede el límite de 25 MB.' : 'No se pudo procesar la carga del PDF.' });
  } finally {
    if (uploaded?.filepath) await unlink(uploaded.filepath).catch(() => undefined);
  }
}
