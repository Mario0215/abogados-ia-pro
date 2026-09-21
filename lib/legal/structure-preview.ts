import { createHash } from 'crypto';
import type { LegalProvisionTypeCode } from './constants';

export type LegalProvisionPreview = {
  temporaryId: string;
  parentTemporaryId: string | null;
  type: LegalProvisionTypeCode;
  designation: string;
  sortOrder: number;
  structurePath: string;
  heading: string | null;
  fullText: string;
  contentHash: string;
};

export type LegalStructurePreview = {
  provisions: LegalProvisionPreview[];
  warnings: string[];
  sourceHash: string;
};

type HeaderMatch = {
  type: LegalProvisionTypeCode;
  designation: string;
  heading: string | null;
  level: number;
};

// Cubre formas habituales de publicación oficial: 15-A, 15 A, 3o. Bis,
// 15-A Bis, Quáter, Quinquies y sus variantes acentuadas. El delimitador
// final se exige en el patrón del encabezado para no confundir texto corrido
// con la designación de un artículo.
const ARTICLE_ADDITION_WORDS = String.raw`BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|SEXIES|SEPTIES|OCTIES|NONIES|DECIES|UND[ÉE]CIES|DUOD[ÉE]CIES`;
const ARTICLE_DESIGNATION = String.raw`\d+(?:\s*(?:O|A|º|ª|°))?(?:\s*[-–—]?\s*[A-Z])?(?:\s*[.\-–—]?\s*(?:${ARTICLE_ADDITION_WORDS}))?`;
const FRACTION_DESIGNATION = String.raw`[IVXLCDM]+|\d+`;
const EDITORIAL_REFORM_NOTE = new RegExp(
  String.raw`^\s*(?:(?:ART[ÍI]CULO\s+${ARTICLE_DESIGNATION}|FRACCI[ÓO]N\s+(?:${FRACTION_DESIGNATION})|(?:${FRACTION_DESIGNATION}))\s*[.:;\-–—]?\s*)?[\[(]*\s*(?:REFORMAD[OA]S?|ADICIONAD[OA]S?|DEROGAD[OA]S?|ABROGAD[OA]S?|SE\s+(?:REFORMA|ADICIONA|DEROGA|ABROGA))\b.*$`,
  'i'
);
const EDITORIAL_NOTE_LABEL = /^\s*(?:NOTAS?|FE\s+DE\s+ERRATAS?|ART[ÍI]CULO\s+REFORMADO)\b/i;

const HEADER_PATTERNS: Array<{ type: LegalProvisionTypeCode; level: number; expression: RegExp }> = [
  { type: 'BOOK', level: 1, expression: /^\s*LIBRO\s+(.+?)\s*$/i },
  { type: 'TITLE', level: 2, expression: /^\s*T[ÍI]TULO\s+(.+?)\s*$/i },
  { type: 'CHAPTER', level: 3, expression: /^\s*CAP[ÍI]TULO\s+(.+?)\s*$/i },
  { type: 'SECTION', level: 4, expression: /^\s*SECCI[ÓO]N\s+(.+?)\s*$/i },
  // Sólo se consideran artículos con numeración. Esto evita convertir notas
  // editoriales como “Artículo reformado DOF …” en artículos normativos.
  { type: 'ARTICLE', level: 5, expression: new RegExp(String.raw`^\s*ART[ÍI]CULO\s+(${ARTICLE_DESIGNATION})(?:\s*[.:;\-–—])+\s*(.*)$`, 'i') },
  // Las fracciones jurídicas son romanas o numéricas; palabras como
  // “reformada” o “adicionada” pertenecen a notas editoriales, no a la norma.
  { type: 'FRACTION', level: 6, expression: new RegExp(String.raw`^\s*FRACCI[ÓO]N\s+(${FRACTION_DESIGNATION})\s*[.)\-–—]?\s*(.*)$`, 'i') },
  { type: 'FRACTION', level: 6, expression: new RegExp(String.raw`^\s*(${FRACTION_DESIGNATION})\s*[.)\-–—]\s*(.*)$`, 'i') },
  { type: 'TRANSITORY', level: 6, expression: /^\s*TRANSITORIO(?:S)?\s+(.+?)\s*[.:;\-–—]?\s*(.*)$/i }
];

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function readHeader(line: string): HeaderMatch | null {
  for (const pattern of HEADER_PATTERNS) {
    const match = line.match(pattern.expression);
    if (!match) continue;
    const designation = compact(match[1] ?? '');
    const trailing = compact(match[2] ?? '');
    if (!designation) return null;
    return {
      type: pattern.type,
      designation,
      heading: trailing || null,
      level: pattern.level
    };
  }
  return null;
}

/**
 * Vista previa no persistente de la jerarquía legal. Sirve para que ADMIN
 * verifique segmentación antes de crear una versión; no interpreta vigencia ni
 * usa IA.
 */
export function previewLegalStructure(rawText: string): LegalStructurePreview {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const warnings: string[] = [];
  const entries: Array<Omit<LegalProvisionPreview, 'contentHash'>> = [];
  const stack = new Map<number, { temporaryId: string; path: string }>();
  const pathOccurrences = new Map<string, number>();
  let repeatedPathCount = 0;
  let editorialNoteCount = 0;
  let current: Omit<LegalProvisionPreview, 'contentHash'> | null = null;

  for (const sourceLine of normalized.split('\n')) {
    const line = sourceLine.trim();
    if (!line) {
      if (current?.fullText) current.fullText += '\n\n';
      continue;
    }
    // Las notas de reforma acompañan el PDF original, pero no son una nueva
    // disposición vigente. Se omiten de la estructura derivada y se reportan
    // para que ADMIN las revise antes de publicar.
    if (EDITORIAL_REFORM_NOTE.test(line) || EDITORIAL_NOTE_LABEL.test(line)) {
      editorialNoteCount += 1;
      continue;
    }
    const header = readHeader(line);
    if (!header) {
      if (current) current.fullText = compact(`${current.fullText} ${line}`);
      continue;
    }

    for (const level of [...stack.keys()]) {
      if (level >= header.level) stack.delete(level);
    }
    const parent = [...stack.entries()]
      .filter(([level]) => level < header.level)
      .sort(([a], [b]) => b - a)[0]?.[1] ?? null;
    const rawPath = `${parent?.path ? `${parent.path}/` : ''}${header.type}:${header.designation.toUpperCase()}`;
    const count = (pathOccurrences.get(rawPath) ?? 0) + 1;
    pathOccurrences.set(rawPath, count);
    const structurePath = count === 1 ? rawPath : `${rawPath}#${count}`;
    if (count > 1) {
      repeatedPathCount += 1;
      if (repeatedPathCount <= 12) {
        warnings.push(`Se detectó una denominación repetida: ${rawPath}. Se conservó con una ruta diferenciada.`);
      }
    }

    const temporaryId = `preview-${entries.length + 1}`;
    current = {
      temporaryId,
      parentTemporaryId: parent?.temporaryId ?? null,
      type: header.type,
      designation: header.designation,
      sortOrder: entries.length + 1,
      structurePath,
      heading: header.heading,
      fullText: header.type === 'ARTICLE' || header.type === 'FRACTION' || header.type === 'TRANSITORY'
        ? compact([header.heading, line.replace(/^\s*[^.:;\-–—]+[.:;\-–—]?\s*/i, '')].filter(Boolean).join(' '))
        : '',
    };
    entries.push(current);
    stack.set(header.level, { temporaryId, path: structurePath });
  }

  if (!entries.some((entry) => entry.type === 'ARTICLE')) {
    warnings.push('No se detectaron artículos. Revisa el formato antes de guardar la versión.');
  }
  if (entries.length === 0 && normalized.trim()) {
    warnings.push('No se detectó estructura jurídica reconocible.');
  }
  if (repeatedPathCount > 12) {
    warnings.push(`Se detectaron ${repeatedPathCount - 12} rutas repetidas adicionales. Revísalas antes de crear o publicar la versión.`);
  }
  if (editorialNoteCount > 0) {
    warnings.push(`Se omitieron ${editorialNoteCount} notas editoriales de reforma de la estructura derivada. El PDF original permanece intacto para su revisión.`);
  }

  return {
    provisions: entries.map((entry) => ({
      ...entry,
      fullText: entry.fullText.trim(),
      contentHash: createHash('sha256').update(`${entry.type}|${entry.designation}|${entry.fullText}`).digest('hex')
    })),
    warnings,
    sourceHash: createHash('sha256').update(normalized).digest('hex')
  };
}
