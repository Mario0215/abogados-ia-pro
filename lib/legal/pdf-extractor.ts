import { createHash } from 'crypto';
import { previewLegalStructure, type LegalStructurePreview } from './structure-preview';

const MAX_EXTRACTED_TEXT_CHARACTERS = 6_000_000;
const MINIMUM_TEXT_CHARACTERS = 120;

type TextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: TextItem[] }> }>;
  destroy?: () => Promise<void> | void;
};

type PdfJsModule = {
  getDocument(input: Record<string, unknown>): { promise: Promise<PdfJsDocument>; destroy?: () => void };
};

type PromiseConstructorWithResolvers = {
  withResolvers?: <T>() => { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void };
};

export type LegalPdfExtraction = {
  text: string;
  textHash: string;
  structuredMarkdown: string;
  structuredHash: string;
  preview: LegalStructurePreview;
  pageCount: number;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// PDF.js 6 uses Promise.withResolvers, which Node 20 (the current local Next
// runtime) does not expose yet. This standards-compatible shim is installed
// before its dynamic import and is a no-op in newer runtimes.
function ensurePromiseWithResolvers() {
  // No usamos `typeof Promise` aquí: las definiciones de Node recientes ya
  // declaran el método como obligatorio aunque el runtime local aún no lo tenga.
  const promiseConstructor = Promise as unknown as PromiseConstructorWithResolvers;
  if (promiseConstructor.withResolvers) return;
  promiseConstructor.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
}

function isWordBoundary(left: string, right: string, gap: number): boolean {
  if (!left || !right || gap <= 1.5) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (/[([{¿¡]$/.test(left) || /^[,.;:!?%\])}]/.test(right)) return false;
  return true;
}

/** Recompone las líneas sin alterar el PDF original ni inventar contenido. */
function pageTextFromItems(items: TextItem[]): string {
  const rows = new Map<number, Array<{ text: string; x: number; width: number }>>();
  for (const item of items) {
    const text = String(item.str ?? '').replace(/\u0000/g, '');
    if (!text) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4] ?? 0);
    const y = Number(transform[5] ?? 0);
    const row = Math.round(y * 2) / 2;
    const bucket = rows.get(row) ?? [];
    bucket.push({ text, x, width: Number(item.width ?? 0) });
    rows.set(row, bucket);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => {
      const ordered = row.sort((a, b) => a.x - b.x);
      let line = '';
      let previous: { text: string; x: number; width: number } | null = null;
      for (const current of ordered) {
        const previousEnd = previous ? previous.x + previous.width : 0;
        if (previous && isWordBoundary(line, current.text, current.x - previousEnd)) line += ' ';
        line += current.text;
        previous = current;
      }
      return line.replace(/[ \t]+/g, ' ').trim();
    })
    .filter(Boolean)
    .join('\n');
}

function markdownFromPreview(preview: LegalStructurePreview): string {
  const headings: Record<string, string> = {
    BOOK: 'Libro',
    TITLE: 'Título',
    CHAPTER: 'Capítulo',
    SECTION: 'Sección',
    ARTICLE: 'Artículo',
    FRACTION: 'Fracción',
    TRANSITORY: 'Transitorio'
  };
  const levels: Record<string, number> = {
    BOOK: 1,
    TITLE: 2,
    CHAPTER: 3,
    SECTION: 4,
    ARTICLE: 5,
    FRACTION: 6,
    TRANSITORY: 6
  };
  const body = preview.provisions.map((provision) => {
    const prefix = '#'.repeat(levels[provision.type] ?? 6);
    const label = headings[provision.type] ?? provision.type;
    const heading = provision.heading ? ` — ${provision.heading}` : '';
    const text = provision.fullText ? `\n\n${provision.fullText}` : '';
    return `${prefix} ${label} ${provision.designation}${heading}${text}`;
  }).join('\n\n');
  return `# Representación estructurada derivada\n\n${body}`.trim();
}

/**
 * Extrae únicamente la capa de texto de un PDF. Si no existe, el llamador debe
 * conservar el archivo y pedir OCR/revisión; jamás se sustituye por texto IA.
 */
export async function extractLegalPdf(buffer: Buffer): Promise<LegalPdfExtraction> {
  ensurePromiseWithResolvers();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as PdfJsModule;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useWorkerFetch: false
  });
  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(pageTextFromItems(textContent.items));
    }
    const text = pages.join('\n\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (text.length > MAX_EXTRACTED_TEXT_CHARACTERS) {
      throw new Error(`El texto extraído supera el límite de ${MAX_EXTRACTED_TEXT_CHARACTERS.toLocaleString('es-MX')} caracteres.`);
    }
    if (text.replace(/\s/g, '').length < MINIMUM_TEXT_CHARACTERS) {
      throw new Error('OCR_REQUIRED');
    }
    const preview = previewLegalStructure(text);
    const structuredMarkdown = markdownFromPreview(preview);
    return {
      text,
      textHash: hash(text),
      structuredMarkdown,
      structuredHash: hash(structuredMarkdown),
      preview,
      pageCount: document.numPages
    };
  } finally {
    await document.destroy?.();
    loadingTask.destroy?.();
  }
}
