/**
 * Límite explícito de la primera operación de Abogados IA Pro.
 * Estas constantes son la puerta de entrada de la capa jurídica nueva; no
 * reutilizan el catálogo libre de materias del proyecto heredado.
 */
export const SUPPORTED_LEGAL_MATTERS = ['CIVIL', 'FAMILIAR', 'LABORAL'] as const;
export type SupportedLegalMatter = (typeof SUPPORTED_LEGAL_MATTERS)[number];

export const EXCLUDED_LEGAL_MATTERS = [
  'PENAL',
  'MERCANTIL',
  'FISCAL',
  'ADMINISTRATIVO',
  'ADMINISTRATIVA',
  'EMPRESARIAL'
] as const;

export const SUPPORTED_LEGAL_TERRITORIES = ['GUANAJUATO', 'FEDERAL_NACIONAL'] as const;
export type SupportedLegalTerritory = (typeof SUPPORTED_LEGAL_TERRITORIES)[number];

export const LEGAL_NORM_VERSION_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'PUBLISHED',
  'CURRENT',
  'FUTURE',
  'REPEALED',
  'HISTORICAL'
] as const;
export type LegalNormVersionStatusCode = (typeof LEGAL_NORM_VERSION_STATUSES)[number];

export const LEGAL_SOURCE_TRUST_LEVELS = [
  'PRIMARY_OFFICIAL',
  'OFFICIAL_CONSOLIDATED',
  'OFFICIAL_OPERATIONAL',
  'CURATED_INTERNAL'
] as const;
export type LegalSourceTrustLevelCode = (typeof LEGAL_SOURCE_TRUST_LEVELS)[number];

export const LEGAL_PROVISION_TYPES = [
  'BOOK',
  'TITLE',
  'CHAPTER',
  'SECTION',
  'ARTICLE',
  'FRACTION',
  'TRANSITORY'
] as const;
export type LegalProvisionTypeCode = (typeof LEGAL_PROVISION_TYPES)[number];

export const LEGAL_APPLICABILITY_RESULTS = ['RESOLVED', 'REQUIRES_REVIEW', 'BLOCKED'] as const;
export type LegalApplicabilityResultCode = (typeof LEGAL_APPLICABILITY_RESULTS)[number];

export const LEGAL_REGIMES = ['CPC_GTO_LEGACY', 'CNPCF', 'LABORAL_FEDERAL'] as const;
export type LegalRegimeCode = (typeof LEGAL_REGIMES)[number];

export type LegalNormCatalogEntry = {
  canonicalId: string;
  officialName: string;
  primaryMatter: SupportedLegalMatter;
  matters: readonly SupportedLegalMatter[];
  scope: 'STATE' | 'FEDERAL' | 'NATIONAL';
  issuingAuthority: string;
  officialUrl: string;
  requiredForInitialOperation: boolean;
  notes: string;
};

/**
 * Metadatos iniciales solamente. No son textos normativos ni afirman vigencia:
 * cada texto y fecha debe cargarse desde una fuente oficial en ADMIN.
 */
export const INITIAL_LEGAL_NORM_CATALOG: readonly LegalNormCatalogEntry[] = [
  {
    canonicalId: 'CC_GTO',
    officialName: 'Código Civil para el Estado de Guanajuato',
    primaryMatter: 'CIVIL',
    matters: ['CIVIL', 'FAMILIAR'],
    scope: 'STATE',
    issuingAuthority: 'Congreso del Estado de Guanajuato',
    officialUrl: 'https://portal.congresogto.gob.mx/codigos/codigo-civil-para-el-estado-de-guanajuato',
    requiredForInitialOperation: true,
    notes: 'Norma sustantiva estatal. Cargar versiones y vigencia desde fuente oficial.'
  },
  {
    canonicalId: 'CPC_GTO',
    officialName: 'Código de Procedimientos Civiles para el Estado de Guanajuato',
    primaryMatter: 'CIVIL',
    matters: ['CIVIL', 'FAMILIAR'],
    scope: 'STATE',
    issuingAuthority: 'Congreso del Estado de Guanajuato',
    officialUrl: 'https://www.congresogto.gob.mx/codigos/codigo-de-procedimientos-civiles-para-el-estado-de-guanajuato',
    requiredForInitialOperation: true,
    notes: 'Régimen procesal legado; su uso depende de reglas de transición verificadas.'
  },
  {
    canonicalId: 'CNPCF',
    officialName: 'Código Nacional de Procedimientos Civiles y Familiares',
    primaryMatter: 'CIVIL',
    matters: ['CIVIL', 'FAMILIAR'],
    scope: 'NATIONAL',
    issuingAuthority: 'Congreso de la Unión',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/index.htm',
    requiredForInitialOperation: true,
    notes: 'La fecha de aplicación en Guanajuato debe configurarse con fuente comprobable; nunca se infiere.'
  },
  {
    canonicalId: 'LFT',
    officialName: 'Ley Federal del Trabajo',
    primaryMatter: 'LABORAL',
    matters: ['LABORAL'],
    scope: 'FEDERAL',
    issuingAuthority: 'Congreso de la Unión',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lft.htm',
    requiredForInitialOperation: true,
    notes: 'Base federal para asuntos laborales privados operados en Guanajuato.'
  },
  {
    canonicalId: 'CPEUM',
    officialName: 'Constitución Política de los Estados Unidos Mexicanos',
    primaryMatter: 'CIVIL',
    matters: ['CIVIL', 'FAMILIAR', 'LABORAL'],
    scope: 'FEDERAL',
    issuingAuthority: 'Constituyente Permanente',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/ref/cpeum.htm',
    requiredForInitialOperation: true,
    notes: 'Incluye el artículo 123 como referencia constitucional laboral; su aplicabilidad se acota por materia.'
  },
  {
    canonicalId: 'CONSTITUCION_GTO',
    officialName: 'Constitución Política para el Estado de Guanajuato',
    primaryMatter: 'CIVIL',
    matters: ['CIVIL', 'FAMILIAR'],
    scope: 'STATE',
    issuingAuthority: 'Congreso del Estado de Guanajuato',
    officialUrl: 'https://portal.congresogto.gob.mx/constitucion-politica-del-estado-de-guanajuato',
    requiredForInitialOperation: true,
    notes: 'Complemento constitucional estatal para Civil y Familiar.'
  },
  {
    canonicalId: 'LEY_DNNA_GTO',
    officialName: 'Ley de los Derechos de Niñas, Niños y Adolescentes del Estado de Guanajuato',
    primaryMatter: 'FAMILIAR',
    matters: ['FAMILIAR'],
    scope: 'STATE',
    issuingAuthority: 'Congreso del Estado de Guanajuato',
    officialUrl: 'https://www.congresogto.gob.mx/leyes/ley-de-los-derechos-de-ninas-ninos-y-adolescentes-del-estado-de-guanajuato',
    requiredForInitialOperation: false,
    notes: 'Complemento para servicios familiares que involucren niñas, niños o adolescentes; habilitar por servicio y fuente verificada.'
  },
  {
    canonicalId: 'LOCFCRL',
    officialName: 'Ley Orgánica del Centro Federal de Conciliación y Registro Laboral',
    primaryMatter: 'LABORAL',
    matters: ['LABORAL'],
    scope: 'FEDERAL',
    issuingAuthority: 'Congreso de la Unión',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LOCFCRL_060120.pdf',
    requiredForInitialOperation: false,
    notes: 'Habilitar únicamente para flujos de conciliación/registro federal que el servicio operativo autorice.'
  }
];

export function isSupportedLegalMatter(value: unknown): value is SupportedLegalMatter {
  return typeof value === 'string' && (SUPPORTED_LEGAL_MATTERS as readonly string[]).includes(value.toUpperCase());
}

export function normalizeLegalMatter(value: unknown): SupportedLegalMatter | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return isSupportedLegalMatter(normalized) ? normalized : null;
}

export function isSupportedLegalTerritory(value: unknown): value is SupportedLegalTerritory {
  return typeof value === 'string' && (SUPPORTED_LEGAL_TERRITORIES as readonly string[]).includes(value.toUpperCase());
}

/** Normaliza únicamente alias técnicos conocidos; municipios/estados no se adivinan. */
export function normalizeLegalTerritory(value: unknown): SupportedLegalTerritory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'GTO' || normalized === 'GUANAJUATO') return 'GUANAJUATO';
  if (normalized === 'FEDERAL' || normalized === 'NACIONAL' || normalized === 'FEDERAL_NACIONAL') return 'FEDERAL_NACIONAL';
  return null;
}

export function isLegalNormVersionStatus(value: unknown): value is LegalNormVersionStatusCode {
  return typeof value === 'string' && (LEGAL_NORM_VERSION_STATUSES as readonly string[]).includes(value);
}

export function isLegalSourceTrustLevel(value: unknown): value is LegalSourceTrustLevelCode {
  return typeof value === 'string' && (LEGAL_SOURCE_TRUST_LEVELS as readonly string[]).includes(value);
}

export function isLegalApplicabilityResult(value: unknown): value is LegalApplicabilityResultCode {
  return typeof value === 'string' && (LEGAL_APPLICABILITY_RESULTS as readonly string[]).includes(value);
}

export function isLegalRegime(value: unknown): value is LegalRegimeCode {
  return typeof value === 'string' && (LEGAL_REGIMES as readonly string[]).includes(value);
}

export function getInitialLegalNorm(canonicalId: string): LegalNormCatalogEntry | undefined {
  return INITIAL_LEGAL_NORM_CATALOG.find((entry) => entry.canonicalId === canonicalId);
}
