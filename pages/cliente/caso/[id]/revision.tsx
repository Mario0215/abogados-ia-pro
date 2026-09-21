import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { prisma } from '../../../../lib/prisma';
import { getClienteFromCookies } from '../../../../lib/cliente-auth';
import { PORTAL_CONFIG } from '../../../../lib/cliente-config';
import { getCaseFinancialSummary } from '../../../../lib/finance';

type Props = {
  caseId: string;
  expediente: string;
  contenido: string;
  nombreDespacho: string;
  blocked: boolean;
  required: number;
  paid: number;
  chatEvents: Array<{ id: string; from: string | null; to: string | null; message: string | null; createdAt: string }>;
};

const G = '#896419';
const BG = '#faf9f7';
const CARD = '#ffffff';
const BORDER = '#e8e8e8';
const TITLE = '#1a1a1a';
const MUTED = '#6b6b6b';

export default function RevisionDemanda({ caseId, expediente, contenido, nombreDespacho, blocked, chatEvents }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<'idle' | 'comentando' | 'cargando' | 'exito_aprobacion' | 'exito_comentario'>('idle');
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [chat, setChat] = useState<Array<{ id: string; from: string | null; to: string | null; message: string | null; createdAt: string }>>(() => chatEvents || []);
  const [chatMsg, setChatMsg] = useState('');
  const [chatSending, setChatSending] = useState(false);

  async function aprobar() {
    setEstado('cargando');
    setError('');
    try {
      const r = await fetch(`/api/cliente/casos/${caseId}/aprobar`, { method: 'PATCH' });
      if (r.ok) {
        setEstado('exito_aprobacion');
        setTimeout(() => router.push('/cliente/dashboard'), 2500);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'Ocurrió un error. Intenta de nuevo.');
        setEstado('idle');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setEstado('idle');
    }
  }

  async function enviarComentario() {
    if (!comentario.trim()) { setError('Escribe tu comentario antes de enviarlo.'); return; }
    setEstado('cargando');
    setError('');
    try {
      const r = await fetch(`/api/cliente/casos/${caseId}/comentario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      if (r.ok) {
        setEstado('exito_comentario');
        setTimeout(() => router.push('/cliente/dashboard'), 2500);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'Ocurrió un error. Intenta de nuevo.');
        setEstado('idle');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setEstado('idle');
    }
  }

  const cargando = estado === 'cargando';

  return (
    <>
      <Head><title>Revisa tu demanda — {nombreDespacho}</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${TITLE}; -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/cliente/dashboard" style={{ fontSize: 14, color: MUTED }}>← Mi caso</Link>
          <span style={{ fontSize: 14, color: '#a0a0a0' }}>Exp. {expediente}</span>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Título */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: TITLE, lineHeight: 1.3, marginBottom: 8 }}>
            Revisa tu demanda
          </h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>
            Tu abogado la preparó especialmente para tu caso. Léela con calma.
          </p>
        </div>

        {/* Contenido de la demanda */}
        <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '28px 24px', marginBottom: 24, maxHeight: 480, overflowY: 'auto' }}>
          {contenido ? (
            <div style={{ fontSize: 16, lineHeight: 1.9, color: TITLE, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
              {contenido}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 15 }}>
              {blocked ? (
                <>
                  Tu demanda está temporalmente bloqueada por un pago pendiente.
                  <br />
                  <span style={{ fontSize: 13, color: '#a0a0a0', marginTop: 8, display: 'block' }}>
                    Para continuar, completa el anticipo.
                  </span>
                </>
              ) : (
                <>
                  Tu abogado aún no ha subido el contenido de tu demanda.
                  <br />
                  <span style={{ fontSize: 13, color: '#a0a0a0', marginTop: 8, display: 'block' }}>
                    Te avisaremos por correo cuando esté lista.
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mensajes */}
        <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '22px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TITLE }}>Mensajes</div>
            <div style={{ fontSize: 12, color: '#a0a0a0' }}>Copia a administración</div>
          </div>

          {(chat.length === 0 ? [] : chat).length === 0 ? (
            <div style={{ fontSize: 13, color: '#9b9b9b', padding: '6px 0 14px' }}>Aún no hay mensajes.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              {chat.map(m => (
                <div key={m.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: MUTED }}>{m.from || '—'}{m.to ? ` → ${m.to}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#a0a0a0', whiteSpace: 'nowrap' }}>{m.createdAt}</div>
                  </div>
                  <div style={{ fontSize: 13, color: TITLE, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.message || '—'}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Nuevo mensaje</div>
            <textarea value={chatMsg} onChange={e => setChatMsg(e.target.value)} rows={3} style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 12px', fontSize: 14, resize: 'vertical' }} placeholder="Escribe tu mensaje para tu abogado..." />
          </div>

          <button
            onClick={async () => {
              const msg = chatMsg.trim();
              if (!msg) return;
              setChatSending(true);
              setError('');
              try {
                const r = await fetch(`/api/cliente/casos/${caseId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
                const d = await r.json().catch(() => ({}));
                if (r.ok && d.event) {
                  setChat(prev => [...prev, { ...d.event, createdAt: d.event?.createdAt ? new Date(d.event.createdAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX') }]);
                  setChatMsg('');
                } else {
                  setError(d.error || 'No se pudo enviar el mensaje.');
                }
              } catch {
                setError('Error de conexión. Intenta de nuevo.');
              } finally {
                setChatSending(false);
              }
            }}
            disabled={chatSending}
            style={{ width: '100%', background: chatSending ? '#d4b97a' : G, border: 'none', borderRadius: 12, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: chatSending ? 'not-allowed' : 'pointer' }}
          >
            Enviar mensaje
          </button>
        </div>

        {/* Mensajes de éxito */}
        {estado === 'exito_aprobacion' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#166534', marginBottom: 6 }}>¡Perfecto! Aprobaste tu demanda</div>
            <p style={{ fontSize: 14, color: '#15803d' }}>Tu abogado agendará la firma contigo muy pronto.</p>
          </div>
        )}

        {estado === 'exito_comentario' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Recibimos tu comentario</div>
            <p style={{ fontSize: 14, color: '#b45309' }}>Tu abogado lo revisará y te avisará cuando tenga lista la corrección.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 14, color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {/* Botones de acción */}
        {!['exito_aprobacion', 'exito_comentario'].includes(estado) && contenido && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Botón aprobar */}
            {estado !== 'comentando' && (
              <button
                onClick={aprobar}
                disabled={cargando}
                style={{ background: cargando ? '#a3a3a3' : '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '18px', fontSize: 17, fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
              >
                {cargando ? 'Procesando...' : 'Todo está bien, apruebo ✅'}
              </button>
            )}

            {/* Botón comentar / textarea */}
            {estado === 'idle' && (
              <button
                onClick={() => setEstado('comentando')}
                style={{ background: '#f5f5f5', color: TITLE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
              >
                Tengo un comentario
              </button>
            )}

            {estado === 'comentando' && (
              <div>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Escribe aquí lo que quieres cambiar o tu duda..."
                  rows={5}
                  style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', fontSize: 15, color: TITLE, background: CARD, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={enviarComentario}
                    disabled={cargando}
                    style={{ flex: 2, background: cargando ? '#a3a3a3' : G, color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}
                  >
                    {cargando ? 'Enviando...' : 'Enviar comentario'}
                  </button>
                  <button
                    onClick={() => { setEstado('idle'); setComentario(''); setError(''); }}
                    style={{ flex: 1, background: '#f5f5f5', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return { redirect: { destination: '/cliente/login', permanent: false } };

  const caseId = params?.id as string;
  if (!caseId) return { redirect: { destination: '/cliente/dashboard', permanent: false } };

  try {
    const portalUser: any = await (prisma as any).clientPortalUser.findUnique({
      where: { id: auth.uid },
      select: { clientId: true },
    });

    if (!portalUser?.clientId) return { redirect: { destination: '/cliente/dashboard', permanent: false } };

    const caso: any = await (prisma as any).legalCase.findFirst({
      where: { id: caseId, clientId: portalUser.clientId, isActive: true },
      select: { id: true, expediente: true, context: true, estatusCliente: true, precioCliente: true },
    });

    if (!caso) return { redirect: { destination: '/cliente/dashboard', permanent: false } };

    let required = 0;
    let paid = 0;
    let financeUnavailable = false;
    try {
      const financial = await getCaseFinancialSummary(prisma as any, caso.id);
      const precio = typeof financial?.precioCliente === 'number' ? Number(financial.precioCliente) : 0;
      required = precio > 0 ? Math.round(precio * 0.5) : 0;
      if (required > 0) {
        paid = Number(financial?.totalCobrado || 0);
      }
    } catch {
      financeUnavailable = true;
    }
    const blocked = financeUnavailable || (required > 0 && paid < required);
    const rawChat = await prisma.caseEvent.findMany({ where: { caseId: caso.id, type: 'CHAT' }, orderBy: { createdAt: 'asc' }, take: 200 });

    return {
      props: {
        caseId: caso.id,
        expediente: caso.expediente,
        contenido: blocked ? '' : (caso.context || ''),
        nombreDespacho: PORTAL_CONFIG.nombreDespacho,
        blocked,
        required,
        paid,
        chatEvents: rawChat.map((e: any) => ({ id: e.id, from: e.from || null, to: e.to || null, message: e.message || null, createdAt: new Date(e.createdAt).toLocaleString('es-MX') })),
      },
    };
  } catch {
    return { redirect: { destination: '/cliente/dashboard', permanent: false } };
  }
};
