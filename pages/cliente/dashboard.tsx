import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { getClienteFromCookies } from '../../lib/cliente-auth';
import { PORTAL_CONFIG } from '../../lib/cliente-config';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
type Abogado = { name: string; ciudad: string | null };
type Documento = { id: string; originalName: string; concept: string | null };
type DocRequest = { id: string; key: string; label: string; status: string; createdAt: string; receivedAt?: string; attachmentId?: string };

type Caso = {
  id: string;
  expediente: string;
  intent: string | null;
  matter: string;
  estatusCliente: string;
  context: string | null;
  abogado: Abogado | null;
  attachments: Documento[];
  docRequests: DocRequest[];
  fechaCreacion: string;
};

type Props = {
  nombre: string;
  caso: Caso | null;
  nombreDespacho: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Estatus visibles al cliente
// ─────────────────────────────────────────────────────────────────────────────
const ESTATUS: Record<string, { icon: string; texto: string; siguiente: string }> = {
  PENDIENTE: {
    icon: '✅',
    texto: 'Recibimos tu caso',
    siguiente: 'Estamos buscando el abogado ideal para ti. Te avisaremos en cuanto lo tengamos.',
  },
  ASIGNADO: {
    icon: '✅',
    texto: 'Te asignamos un abogado',
    siguiente: 'Tu abogado ya está revisando tu información para preparar tu demanda.',
  },
  EN_REVISION_ABOGADO: {
    icon: '⏳',
    texto: 'Tu abogado está trabajando en tu caso',
    siguiente: 'Está preparando tu demanda. Te avisaremos cuando esté lista para que la revises.',
  },
  DEMANDA_LISTA: {
    icon: '📄',
    texto: 'Tu demanda está lista',
    siguiente: 'Tu abogado terminó de redactarla. En breve podrás revisarla aquí.',
  },
  EN_REVISION_CLIENTE: {
    icon: '👆',
    texto: 'Necesitamos tu aprobación',
    siguiente: 'Tu abogado preparó tu demanda. Léela y dinos si estás de acuerdo.',
  },
  APROBADA: {
    icon: '✅',
    texto: 'Aprobaste tu demanda',
    siguiente: 'Tu abogado agendará la firma contigo muy pronto.',
  },
  PENDIENTE_FIRMA: {
    icon: '✍️',
    texto: 'Listos para firmar',
    siguiente: '',
  },
  PRESENTADA: {
    icon: '✅',
    texto: 'Tu demanda fue presentada',
    siguiente: 'Ya está en el juzgado. Ahora esperamos la respuesta del juez.',
  },
  EN_PROCESO: {
    icon: '⚖️',
    texto: 'Tu caso está en el juzgado',
    siguiente: 'Tu abogado está atendiendo las etapas del proceso. Te avisaremos de cada avance.',
  },
  RESUELTO: {
    icon: '🎉',
    texto: '¡Tu caso fue resuelto!',
    siguiente: 'El proceso ha concluido. Fue un honor poder ayudarte.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Barra de progreso — 4 pasos simples
// ─────────────────────────────────────────────────────────────────────────────
const PASOS = ['Tu caso', 'Tu demanda', 'En el juzgado', 'Resuelto'];

function getPasoActual(estatus: string): number {
  if (estatus === 'RESUELTO') return 4;
  if (['PRESENTADA', 'EN_PROCESO'].includes(estatus)) return 3;
  if (['DEMANDA_LISTA', 'EN_REVISION_CLIENTE', 'APROBADA', 'PENDIENTE_FIRMA'].includes(estatus)) return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colores
// ─────────────────────────────────────────────────────────────────────────────
const G = '#896419';
const BG = '#faf9f7';
const CARD = '#ffffff';
const BORDER = '#e8e8e8';
const TITLE = '#1a1a1a';
const MUTED = '#6b6b6b';
const FAINT = '#a0a0a0';

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────
export default function ClienteDashboard({ nombre, caso, nombreDespacho }: Props) {
  const primerNombre = nombre.split(' ')[0];
  const estatus = caso?.estatusCliente || 'PENDIENTE';
  const info = ESTATUS[estatus] || ESTATUS['PENDIENTE'];
  const paso = caso ? getPasoActual(estatus) : 0;

  return (
    <>
      <Head><title>Mi caso — {nombreDespacho}</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${TITLE}; -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: TITLE }}>{nombreDespacho}</span>
          <Link href="/api/cliente/auth/logout" style={{ fontSize: 14, color: FAINT }}>Salir</Link>
        </div>
      </header>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* ── SALUDO ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: TITLE, lineHeight: 1.3 }}>
            Hola, {primerNombre} 👋
          </h1>
          <p style={{ fontSize: 16, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
            Aquí puedes ver cómo va tu caso.
          </p>
        </div>

        {/* ── SIN CASO ── */}
        {!caso && (
          <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: TITLE, marginBottom: 10 }}>
              Aún no tienes ningún caso registrado
            </div>
            <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, marginBottom: 28, maxWidth: 320, margin: '0 auto 28px' }}>
              Inicia tu caso en línea en minutos y recibe una cotización automática.
            </p>
            <Link
              href="/cliente/cuestionario"
              style={{ display: 'inline-block', background: G, color: '#fff', borderRadius: 12, padding: '16px 32px', fontSize: 16, fontWeight: 700 }}
            >
              Iniciar mi caso
            </Link>
          </div>
        )}

        {caso && (
          <>
            {/* ── TARJETA DE ESTADO ── */}
            <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, borderLeft: `5px solid ${G}`, padding: '28px 24px', marginBottom: 20 }}>
              <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>{info.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TITLE, marginBottom: 10, lineHeight: 1.3 }}>
                {info.texto}
              </div>

              {/* Acción especial: revisar demanda */}
              {estatus === 'EN_REVISION_CLIENTE' && (
                <div style={{ marginTop: 6, marginBottom: 12 }}>
                  <p style={{ fontSize: 15, color: MUTED, marginBottom: 18, lineHeight: 1.6 }}>
                    Tu abogado preparó tu demanda. Léela con calma y dinos si estás de acuerdo.
                  </p>
                  <Link
                    href={`/cliente/caso/${caso.id}/revision`}
                    style={{ display: 'block', background: G, color: '#fff', borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 700, textAlign: 'center' }}
                  >
                    Ver mi demanda
                  </Link>
                </div>
              )}

              {/* Acción especial: pendiente de firma */}
              {estatus === 'PENDIENTE_FIRMA' && caso.abogado && (
                <div style={{ background: '#fffbeb', borderRadius: 10, padding: '16px 18px', marginTop: 6, marginBottom: 6 }}>
                  <p style={{ fontSize: 15, color: '#92400e', lineHeight: 1.6 }}>
                    Tu abogado <strong>{caso.abogado.name}</strong> te contactará pronto para que firmes tu demanda. Te avisaremos por correo.
                  </p>
                </div>
              )}

              {/* Mensaje de felicitación */}
              {estatus === 'RESUELTO' && (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '16px 18px', marginTop: 6, marginBottom: 6 }}>
                  <p style={{ fontSize: 15, color: '#166534', lineHeight: 1.6 }}>
                    Tu caso fue resuelto satisfactoriamente. Gracias por confiar en nosotros.
                  </p>
                </div>
              )}

              {/* Qué sigue — texto genérico para el resto de estatus */}
              {info.siguiente && !['EN_REVISION_CLIENTE', 'PENDIENTE_FIRMA', 'RESUELTO'].includes(estatus) && (
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>{info.siguiente}</p>
              )}
            </div>

            {/* ── BARRA DE PROGRESO 4 PASOS ── */}
            <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                {PASOS.map((label, i) => {
                  const n = i + 1;
                  const done = n < paso;
                  const current = n === paso;
                  return (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Línea + círculo */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {/* Línea izquierda */}
                        {i > 0 && (
                          <div style={{ flex: 1, height: 3, background: done || current ? G : '#e8e8e8', borderRadius: 2 }} />
                        )}
                        {/* Círculo */}
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: done ? G : current ? CARD : '#f5f5f5',
                          border: `3px solid ${done || current ? G : '#e8e8e8'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: done ? 14 : 13, fontWeight: 700,
                          color: done ? '#fff' : current ? G : FAINT,
                        }}>
                          {done ? '✓' : n}
                        </div>
                        {/* Línea derecha */}
                        {i < PASOS.length - 1 && (
                          <div style={{ flex: 1, height: 3, background: done ? G : '#e8e8e8', borderRadius: 2 }} />
                        )}
                      </div>
                      {/* Label */}
                      <div style={{ fontSize: 11, color: done || current ? TITLE : FAINT, fontWeight: current ? 700 : 400, marginTop: 8, textAlign: 'center', lineHeight: 1.3 }}>
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TU ABOGADO ── */}
            {caso.abogado && estatus !== 'PENDIENTE' && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Tu abogado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  {/* Avatar con iniciales */}
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${G}20`, border: `2px solid ${G}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: G, flexShrink: 0 }}>
                    {caso.abogado.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: TITLE }}>{caso.abogado.name}</div>
                    {caso.abogado.ciudad && (
                      <div style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{caso.abogado.ciudad}</div>
                    )}
                  </div>
                </div>
                <Link
                  href="/cliente/faq"
                  style={{ display: 'block', background: '#f5f5f5', color: TITLE, borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, textAlign: 'center' }}
                >
                  Preguntas frecuentes
                </Link>
              </div>
            )}

            {/* ── DOCUMENTOS ── */}
            {caso.docRequests.length > 0 && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Documentos requeridos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {caso.docRequests.map((req) => {
                    const received = caso.attachments.some((a) => a.concept === `DOC:${req.key}`);
                    return (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', borderRadius: 8, padding: '12px 14px', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, color: TITLE, lineHeight: 1.4 }}>{req.label}</div>
                          <div style={{ fontSize: 12, color: received ? '#16a34a' : MUTED, marginTop: 4 }}>{received ? 'Recibido' : 'Pendiente'}</div>
                        </div>
                        {!received && (
                          <label style={{ background: G, color: '#fff', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Subir
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const fd = new FormData();
                                fd.set('key', req.key);
                                fd.set('file', f);
                                await fetch(`/api/cliente/casos/${caso.id}/upload`, { method: 'POST', body: fd });
                                location.reload();
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {caso.attachments.length > 0 && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '24px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Documentos de tu expediente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {caso.attachments.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', borderRadius: 8, padding: '12px 14px' }}>
                      <span style={{ fontSize: 14, color: TITLE, lineHeight: 1.4 }}>{doc.originalName}</span>
                      <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>Recibido ✅</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FAQ (si no hay abogado aún) ── */}
            {!caso.abogado && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Link href="/cliente/faq" style={{ fontSize: 14, color: MUTED }}>
                  Preguntas frecuentes sobre tu caso
                </Link>
              </div>
            )}
          </>
        )}
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
      include: {
        client: {
          include: {
            cases: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                abogado: { select: { name: true, ciudad: true } },
                attachments: { select: { id: true, originalName: true, concept: true } },
              },
            },
          },
        },
      },
    });

    if (!portalUser) return { redirect: { destination: '/cliente/login', permanent: false } };

    const rawCaso = portalUser.client?.cases?.[0] ?? null;
    const notesObj = (() => { try { return JSON.parse(rawCaso?.notes || '{}'); } catch { return {}; } })();
    const docRequestsRaw = Array.isArray(notesObj.docRequests) ? notesObj.docRequests : [];

    const caso: Caso | null = rawCaso
      ? {
          id: rawCaso.id,
          expediente: rawCaso.expediente,
          intent: rawCaso.intent || null,
          matter: rawCaso.matter,
          estatusCliente: rawCaso.estatusCliente || 'PENDIENTE',
          context: rawCaso.context || null,
          abogado: rawCaso.abogado ? { name: rawCaso.abogado.name, ciudad: rawCaso.abogado.ciudad || null } : null,
          attachments: (rawCaso.attachments || []).map((a: any) => ({
            id: a.id,
            originalName: a.originalName,
            concept: a.concept || null,
          })),
          docRequests: docRequestsRaw.map((r: any) => ({
            id: String(r.id || ''),
            key: String(r.key || ''),
            label: String(r.label || ''),
            status: String(r.status || 'PENDIENTE'),
            createdAt: String(r.createdAt || ''),
            receivedAt: r.receivedAt ? String(r.receivedAt) : undefined,
            attachmentId: r.attachmentId ? String(r.attachmentId) : undefined,
          })),
          fechaCreacion: new Date(rawCaso.createdAt).toLocaleDateString('es-MX'),
        }
      : null;

    return {
      props: {
        nombre: portalUser.name,
        caso,
        nombreDespacho: PORTAL_CONFIG.nombreDespacho,
      },
    };
  } catch {
    return { redirect: { destination: '/cliente/login', permanent: false } };
  }
};
