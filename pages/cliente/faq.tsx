import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useState } from 'react';
import { prisma } from '../../lib/prisma';
import { getClienteFromCookies } from '../../lib/cliente-auth';
import { PORTAL_CONFIG } from '../../lib/cliente-config';

type Pregunta = { pregunta: string; respuesta: string };
type Props = { casoTipo: string | null; nombreDespacho: string };

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas generales (siempre visibles)
// ─────────────────────────────────────────────────────────────────────────────
const GENERALES: Pregunta[] = [
  {
    pregunta: '¿Cuánto tiempo tarda mi caso?',
    respuesta: 'Depende del tipo de caso. Un divorcio por mutuo acuerdo tarda entre 2 y 4 meses. Te iremos avisando en cada paso para que siempre sepas cómo va.',
  },
  {
    pregunta: '¿Tengo que ir al juzgado?',
    respuesta: 'Solo cuando haya audiencias. Tu abogado se encarga de todo lo demás: presentar documentos, dar seguimiento y representarte.',
  },
  {
    pregunta: '¿Cómo me avisan de los avances?',
    respuesta: 'Te mandamos un correo en cada paso importante. También puedes ver el estado aquí en tu portal, en cualquier momento.',
  },
  {
    pregunta: '¿Puedo hablar con mi abogado?',
    respuesta: 'Tu abogado te contactará directamente cuando necesiten coordinar algo importante, como la firma de tu demanda o una audiencia.',
  },
  {
    pregunta: '¿Qué pasa si no estoy de acuerdo con mi demanda?',
    respuesta: 'Cuando tu demanda esté lista, podrás revisarla aquí y enviarnos tus comentarios. Tu abogado los tomará en cuenta y te mandará una versión corregida.',
  },
  {
    pregunta: '¿Es segura mi información?',
    respuesta: 'Sí. Toda tu información está protegida y solo tu abogado asignado tiene acceso a ella.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas por tipo de caso
// ─────────────────────────────────────────────────────────────────────────────
const POR_TIPO: Record<string, { titulo: string; preguntas: Pregunta[] }> = {
  DIVORCIO_MUTUO: {
    titulo: 'Sobre tu divorcio',
    preguntas: [
      { pregunta: '¿Necesito el acuerdo de mi cónyuge?', respuesta: 'En un divorcio por mutuo acuerdo sí. Ambas partes deben estar de acuerdo. Si no lo está, el proceso se vuelve contencioso.' },
      { pregunta: '¿Qué pasa con mis hijos durante el proceso?', respuesta: 'El juez determinará la guarda, custodia y pensión alimenticia de tus hijos conforme al Código Civil de Guanajuato.' },
      { pregunta: '¿Quién se queda con la casa?', respuesta: 'Eso se define durante el juicio según los bienes que declararon en común al inicio del proceso.' },
      { pregunta: '¿Puedo volver a casarme después?', respuesta: 'Sí, una vez que el juez dicte sentencia y quede firme podrás contraer nuevas nupcias.' },
    ],
  },
  DIVORCIO_CONTENCIOSO: {
    titulo: 'Sobre tu divorcio',
    preguntas: [
      { pregunta: '¿Necesito que mi cónyuge esté de acuerdo?', respuesta: 'No. En el divorcio contencioso tu abogado presentará la demanda y el juez citará a la otra parte independientemente de su voluntad.' },
      { pregunta: '¿Qué pasa con mis hijos durante el proceso?', respuesta: 'El juez determinará la guarda, custodia y pensión alimenticia de tus hijos conforme al Código Civil de Guanajuato.' },
      { pregunta: '¿Quién se queda con la casa?', respuesta: 'Eso se define durante el juicio. Tu abogado hará valer tus derechos sobre los bienes en común.' },
      { pregunta: '¿Puedo volver a casarme después?', respuesta: 'Sí, una vez que el juez dicte sentencia y quede firme podrás contraer nuevas nupcias.' },
    ],
  },
  PENSION_ALIMENTICIA: {
    titulo: 'Sobre tu pensión alimenticia',
    preguntas: [
      { pregunta: '¿Desde cuándo empieza a pagar?', respuesta: 'Desde que el juez dicta el auto de radicación de la demanda, que normalmente ocurre en los primeros días del proceso.' },
      { pregunta: '¿Qué pasa si no paga?', respuesta: 'Se puede solicitar el embargo de bienes o descuento directo de nómina. Tu abogado gestionará las medidas de apremio necesarias.' },
      { pregunta: '¿Se puede aumentar la pensión después?', respuesta: 'Sí, mediante un incidente de aumento de pensión alimenticia si las circunstancias económicas cambian.' },
    ],
  },
  PRESCRIPCION_ADQUISITIVA: {
    titulo: 'Sobre tu prescripción adquisitiva',
    preguntas: [
      { pregunta: '¿Cuántos años necesito de posesión?', respuesta: 'En Guanajuato son 5 años de posesión pacífica, continua y pública del inmueble, conforme al Artículo 826 del Código Civil.' },
      { pregunta: '¿Necesito testigos?', respuesta: 'Sí, al menos dos testigos que conozcan tu posesión del inmueble y puedan declarar ante el juez.' },
      { pregunta: '¿Qué documentos necesito?', respuesta: 'Recibos de pago de servicios, fotos del inmueble, declaraciones de vecinos y cualquier documento que acredite tu posesión continua.' },
    ],
  },
  ARRENDAMIENTO: {
    titulo: 'Sobre tu caso de arrendamiento',
    preguntas: [
      { pregunta: '¿Cuánto tarda el desalojo?', respuesta: 'En Guanajuato entre 3 y 6 meses dependiendo del juzgado y la carga de trabajo. Tu abogado dará el seguimiento puntual.' },
      { pregunta: '¿Puedo cobrar las rentas vencidas?', respuesta: 'Sí, en el mismo juicio puedes demandar el pago de rentas vencidas junto con el desalojo.' },
    ],
  },
  NULIDAD_CONTRATO: {
    titulo: 'Sobre la nulidad de tu contrato',
    preguntas: [
      { pregunta: '¿Qué pasa con el dinero que pagué?', respuesta: 'Si el juez declara la nulidad, tienes derecho a que te restituyan lo que pagaste. Tu abogado incluirá esa petición en la demanda.' },
      { pregunta: '¿Cuánto tarda?', respuesta: 'Entre 6 meses y 1 año dependiendo de la complejidad del caso y la evidencia disponible.' },
    ],
  },
  DANOS_PERJUICIOS: {
    titulo: 'Sobre tu demanda de daños y perjuicios',
    preguntas: [
      { pregunta: '¿Cómo se calcula el monto?', respuesta: 'Se basa en el daño real sufrido más los perjuicios: lo que dejaste de ganar a consecuencia del hecho. Tu abogado lo documentará.' },
      { pregunta: '¿Necesito pruebas?', respuesta: 'Sí, entre más documentación tengas más sólido es tu caso. Facturas, fotos, contratos, testigos — todo ayuda.' },
    ],
  },
  SUCESION: {
    titulo: 'Sobre tu juicio sucesorio',
    preguntas: [
      { pregunta: '¿Qué pasa si no hay testamento?', respuesta: 'Se aplica la sucesión intestamentaria: heredan los familiares más cercanos según el orden establecido en el Código Civil de Guanajuato.' },
      { pregunta: '¿Cuánto tarda?', respuesta: 'Entre 6 meses y 2 años dependiendo del número de herederos, los bienes involucrados y si hay acuerdo entre las partes.' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Colores
// ─────────────────────────────────────────────────────────────────────────────
const BG = '#faf9f7';
const CARD = '#ffffff';
const BORDER = '#e8e8e8';
const TITLE = '#1a1a1a';
const MUTED = '#6b6b6b';
const G = '#896419';

// ─────────────────────────────────────────────────────────────────────────────
// Componente de acordeón
// ─────────────────────────────────────────────────────────────────────────────
function Acordeon({ preguntas }: { preguntas: Pregunta[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {preguntas.map((item, i) => {
        const open = abierto === i;
        return (
          <div key={i} style={{ background: CARD, borderRadius: 10, border: `1px solid ${open ? G : BORDER}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
            <button
              onClick={() => setAbierto(open ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: TITLE, lineHeight: 1.4 }}>{item.pregunta}</span>
              <span style={{ fontSize: 18, color: G, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
            </button>
            {open && (
              <div style={{ padding: '0 20px 18px', fontSize: 15, color: MUTED, lineHeight: 1.7 }}>
                {item.respuesta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────
export default function FAQ({ casoTipo, nombreDespacho }: Props) {
  const especificas = casoTipo ? POR_TIPO[casoTipo] : null;

  return (
    <>
      <Head><title>Preguntas frecuentes — {nombreDespacho}</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${TITLE}; -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/cliente/dashboard" style={{ fontSize: 14, color: MUTED }}>← Mi caso</Link>
          <span style={{ fontSize: 14, color: '#a0a0a0' }}>{nombreDespacho}</span>
        </div>
      </header>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '28px 20px 60px' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: TITLE, marginBottom: 8, lineHeight: 1.3 }}>
            Preguntas frecuentes
          </h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>
            Respuestas a las dudas más comunes sobre tu caso.
          </p>
        </div>

        {/* Preguntas específicas del tipo de caso */}
        {especificas && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: G, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 14 }}>
              {especificas.titulo}
            </div>
            <Acordeon preguntas={especificas.preguntas} />
          </div>
        )}

        {/* Preguntas generales */}
        <div>
          <div style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 14 }}>
            Preguntas generales
          </div>
          <Acordeon preguntas={GENERALES} />
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return { redirect: { destination: '/cliente/login', permanent: false } };

  try {
    const portalUser: any = await (prisma as any).clientPortalUser.findUnique({
      where: { id: auth.uid },
      select: {
        client: {
          select: {
            cases: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { intent: true },
            },
          },
        },
      },
    });

    const casoTipo = portalUser?.client?.cases?.[0]?.intent || null;

    return {
      props: {
        casoTipo,
        nombreDespacho: PORTAL_CONFIG.nombreDespacho,
      },
    };
  } catch {
    return { props: { casoTipo: null, nombreDespacho: PORTAL_CONFIG.nombreDespacho } };
  }
};
