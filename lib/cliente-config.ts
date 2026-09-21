// ─────────────────────────────────────────────────────────────────────────────
// Configuración editable del Portal del Cliente
// Modifica este archivo para actualizar precios, servicios y textos del portal.
// ─────────────────────────────────────────────────────────────────────────────

export const PORTAL_CONFIG = {
  // Nombre del despacho que aparece en el portal
  nombreDespacho: 'Cymnova A.C.',
  tagline: 'Asesoría legal en derecho civil — Guanajuato',

  // Contacto mostrado en el portal
  contacto: {
    email: 'contacto@cymnova.mx',
    telefono: '+52 (477) 000-0000',
    direccion: 'Guanajuato, México',
  },

  // Servicios ofrecidos (se muestran en la landing y en el dashboard)
  servicios: [
    {
      id: 'divorcio',
      nombre: 'Divorcio',
      descripcion: 'Divorcio por mutuo acuerdo o contencioso ante juzgados del estado de Guanajuato.',
      precio: 8500,
      moneda: 'MXN',
      desde: true, // mostrar "Desde $8,500"
    },
    {
      id: 'alimentos',
      nombre: 'Pensión Alimenticia',
      descripcion: 'Demanda de alimentos para menores o mayores de edad conforme al CC GTO.',
      precio: 5000,
      moneda: 'MXN',
      desde: true,
    },
    {
      id: 'arrendamiento',
      nombre: 'Arrendamiento',
      descripcion: 'Cobro de rentas, desahucio, rescisión o terminación de contrato de arrendamiento.',
      precio: 6000,
      moneda: 'MXN',
      desde: true,
    },
    {
      id: 'usucapion',
      nombre: 'Usucapión',
      descripcion: 'Prescripción adquisitiva de bienes inmuebles conforme al Art. 826 CC GTO.',
      precio: 12000,
      moneda: 'MXN',
      desde: true,
    },
    {
      id: 'sucesion',
      nombre: 'Sucesión',
      descripcion: 'Tramitación de juicio sucesorio testamentario o intestamentario.',
      precio: 10000,
      moneda: 'MXN',
      desde: true,
    },
    {
      id: 'consulta',
      nombre: 'Consulta Legal',
      descripcion: 'Asesoría inicial de 60 minutos para evaluación de tu caso.',
      precio: 500,
      moneda: 'MXN',
      desde: false,
    },
  ],

  // Etapas procesales visibles para el cliente en su dashboard
  etapasVisibles: [
    { key: 'BORRADOR',      label: 'En preparación' },
    { key: 'ACTIVO',        label: 'En proceso' },
    { key: 'PRESENTADO',    label: 'Demanda presentada' },
    { key: 'EMPLAZADO',     label: 'Emplazado' },
    { key: 'EN_JUICIO',     label: 'En juicio' },
    { key: 'SENTENCIA',     label: 'Sentencia' },
    { key: 'CONCLUIDO',     label: 'Concluido' },
  ],
} as const;

export type Servicio = typeof PORTAL_CONFIG.servicios[number];

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del cuestionario y marketplace de casos
// ─────────────────────────────────────────────────────────────────────────────

// ID del usuario administrador que actúa como propietario de los casos del portal.
// Configura la variable de entorno ABOGADO_ADMIN_ID con el ID del usuario ADMIN en BD.
export const ABOGADO_ADMIN_ID = process.env.ABOGADO_ADMIN_ID || '';

// Ciudades de Guanajuato para el cuestionario
export const CIUDADES_GTO = [
  'León', 'Irapuato', 'Celaya', 'Salamanca', 'Guanajuato',
  'San Miguel de Allende', 'Silao', 'Dolores Hidalgo',
  'Pénjamo', 'Abasolo', 'Yuriria', 'Moroleón', 'Uriangato',
  'Valle de Santiago', 'Acámbaro', 'Cortazar', 'Villagrán',
  'Comonfort', 'San Luis de la Paz', 'Allende', 'Otro',
] as const;

// Etapas de asignación para el dashboard del cliente (flujo marketplace)
export const ETAPAS_ASIGNACION = [
  { key: 'PENDIENTE',   label: 'Pendiente' },
  { key: 'ASIGNADO',    label: 'Asignado' },
  { key: 'EN_PROCESO',  label: 'En proceso' },
  { key: 'FIRMA',       label: 'Firma' },
  { key: 'PRESENTADA',  label: 'Presentada' },
  { key: 'RESUELTO',    label: 'Resuelto' },
] as const;
