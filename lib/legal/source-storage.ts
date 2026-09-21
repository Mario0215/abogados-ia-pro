import { saveBuffer } from '../storage';

export const MAX_LEGAL_PDF_BYTES = 25 * 1024 * 1024;

export type PersistedLegalOriginal = {
  provider: 'DATABASE' | 'gcs' | 'vercel-blob';
  storagePath: string;
  databaseData: Buffer | null;
};

function configuredProvider(): string {
  return (process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
}

function safeObjectName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'fuente-oficial.pdf';
}

/**
 * Persiste el original antes de extraer su texto. En desarrollo, si no hay
 * proveedor configurado, se conserva en la base de datos de Pro de forma
 * privada; al configurar GCS o Vercel Blob se usa el almacenamiento de objetos.
 */
export async function persistLegalSourceOriginal(input: {
  sourceId: string;
  originalName: string;
  buffer: Buffer;
}): Promise<PersistedLegalOriginal> {
  const provider = configuredProvider();
  if (!provider) {
    return {
      provider: 'DATABASE',
      storagePath: `database://legal-source/${input.sourceId}/original`,
      databaseData: input.buffer
    };
  }

  if (provider !== 'gcs' && provider !== 'vercel-blob') {
    throw new Error('STORAGE_PROVIDER debe ser gcs o vercel-blob para conservar PDFs jurídicos fuera de la base de datos.');
  }

  const objectPath = `legal-sources/${input.sourceId}/${safeObjectName(input.originalName)}`;
  const stored = await saveBuffer(objectPath, input.buffer, 'application/pdf');
  return {
    provider,
    storagePath: stored.url,
    databaseData: null
  };
}
