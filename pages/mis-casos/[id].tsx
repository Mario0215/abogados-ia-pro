import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { prisma } from '../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../lib/auth';
import { computeDeadlineStatus, computeDeadlineAlert } from '../../lib/deadline';
import type { ComputedDeadlineStatus, DeadlineAlert } from '../../lib/deadline';
import AppLayout from '../../components/AppLayout';

type LawyerPayment = { id: string; amount: number; paidAt: string; method: string; reference?: string | null; status: string; voidReason?: string | null };
type Deadline = { id: string; title: string; startDate: string; dueDate: string; termDays: number; status: string };
type Event = { id: string; type: string; from?: string | null; to?: string | null; message?: string | null; createdAt: string };
type Knowledge = {
  id: string;
  caseId: string;
  documentId: string | null;
  snippet: string | null;
  score: number | null;
  sourceType: string | null;
  createdAt: string;
  document: { id: string; title: string; sourceType?: string | null; matter?: string | null; submatter?: string | null } | null;
  legalProvision: { id: string; designation?: string | null; type?: string | null } | null;
};
type ProxVto = { id: string; title: string; dueDate: string; dueDateISO: string; status: string } | null;

type Props = {
  id: string;
  expediente: string;
  counterparty?: string | null;
  intent?: string | null;
  facts?: string | null;
  courtNumber?: string | null;
  courtType?: string | null;
  matter: string;
  type: string;
  priority: string;
  status: string;
  notes: string | null;
  honorarioAbogado?: number | null;
  questionnaireData?: string | null;
  userName: string;
  userRole: 'ABOGADO' | 'ADMIN';
  ciudad: string | null;
  expedienteReal: string | null;
  estadoAsignacion: string | null;
  proximoVencimiento: ProxVto;
  client: { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null } | null;
  attachments: { id: string; originalName: string; concept?: string | null; createdAt: string; mimeType?: string | null }[];
  events: Event[];
  initialLawyerPayments: LawyerPayment[];
  knowledge: Knowledge[];
};

const C = {
  bg: '#faf9f7',
  sidebar: '#f7f7f8',
  card: '#ffffff',
  border: '#e5e5e5',
  borderInput: '#e0e0e0',
  title: '#3d3d3d',
  body: '#4b4b4b',
  muted: '#6b6b6b',
  faint: '#9b9b9b',
  btnPrimary: '#4b4b4b',
  btnPrimaryText: '#ffffff',
  activeTab: '#3d3d3d',
  activeBg: '#efefef',
  green: '#22a06b',
  greenBg: 'rgba(34,160,107,0.08)',
  blue: '#1a6dc2',
  blueBg: 'rgba(26,109,194,0.08)',
  red: '#c0392b',
  redBg: 'rgba(192,57,43,0.08)',
  amber: '#b45309',
  amberBg: 'rgba(180,83,9,0.08)',
  tealBg: 'rgba(13,148,136,0.08)',
  teal: '#0f766e',
};

const STATUS_PRO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  NUEVO:         { label: 'Nuevo',         color: '#0369a1', bg: 'rgba(14,165,233,0.10)' },
  ASIGNADO:      { label: 'Asignado',      color: '#4338ca', bg: 'rgba(99,102,241,0.10)' },
  EN_REVISION:   { label: 'En revisión',   color: '#b45309', bg: 'rgba(245,158,11,0.10)' },
  EN_REDACCION:  { label: 'En redacción',  color: '#92400e', bg: 'rgba(217,119,6,0.10)' },
  DEMANDA_LISTA: { label: 'Demanda lista', color: '#047857', bg: 'rgba(16,185,129,0.10)' },
  PRESENTADO:    { label: 'Presentado',    color: '#15803d', bg: 'rgba(34,197,94,0.10)' },
  SEGUIMIENTO:   { label: 'Seguimiento',   color: '#0e7490', bg: 'rgba(8,145,178,0.10)' },
  CERRADO:       { label: 'Cerrado',       color: '#374151', bg: 'rgba(75,85,99,0.10)' },
  ARCHIVADO:     { label: 'Archivado',     color: '#4b5563', bg: 'rgba(107,114,128,0.10)' },
};

const concepts = [
  { key: 'DEMANDA', label: 'Demanda' },
  { key: 'PRESENTACION', label: 'Presentación' },
  { key: 'ADMISION', label: 'Admisión' },
  { key: 'EMPLAZAMIENTO', label: 'Emplazamiento' },
  { key: 'CONTESTACION', label: 'Contestación' },
  { key: 'PRUEBAS', label: 'Periodo Probatorio' },
  { key: 'AUDIENCIA_FINAL', label: 'Audiencia Final' },
  { key: 'SENTENCIA', label: 'Sentencia' },
];

function completeness(props: Props, deadlines: Deadline[], lawyerPayments: LawyerPayment[]) {
  const checks = [
    { label: 'Hechos del caso', ok: !!props.facts },
    { label: 'Documentos adjuntos', ok: props.attachments.length > 0 },
    { label: 'Cuestionario completado', ok: !!props.questionnaireData },
    { label: 'Plazos registrados', ok: deadlines.length > 0 },
    { label: 'Honorario acordado', ok: props.honorarioAbogado != null || lawyerPayments.length > 0 },
  ];
  const done = checks.filter(c => c.ok).length;
  return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
}

export default function CaseDetail(props: Props) {
  const {
    id, expediente, counterparty, intent, facts, courtNumber, courtType, matter,
    priority, status, notes, honorarioAbogado, userName, userRole, ciudad, expedienteReal,
    estadoAsignacion, proximoVencimiento, client, attachments, events,
    initialLawyerPayments, knowledge
  } = props;

  const TABS = ['hechos', 'documentos', 'plazos', 'referencias', 'notas', 'chat', 'cobranza', 'timeline'] as const;
  type Tab = typeof TABS[number];
  const TAB_LABELS: Record<Tab, string> = {
    hechos: 'Hechos',
    documentos: 'Documentos',
    plazos: 'Plazos',
    referencias: 'Referencias Jurídicas',
    notas: 'Notas',
    chat: 'Chat',
    cobranza: 'Honorarios',
    timeline: 'Timeline',
  };

  const [activeTab, setActiveTab] = useState<Tab>('hechos');
  const [localPriority] = useState(priority);
  const [localStatus] = useState(status);
  const [notesObj] = useState<any>(() => { try { return JSON.parse(notes || '{}'); } catch { return {}; } });
  const [lawyerNotes, setLawyerNotes] = useState<string[]>(() => { try { const o = JSON.parse(notes || '{}'); return Array.isArray(o?.lawyerNotes) ? o.lawyerNotes : []; } catch { return []; } });
  const [nextNote, setNextNote] = useState('');
  const [localFacts, setLocalFacts] = useState(facts || '');
  const [info, setInfo] = useState('');
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const lawyerPayments = initialLawyerPayments;
  const [chatEvents, setChatEvents] = useState<any[]>(() => (events || []).filter((e: any) => e.type === 'CHAT'));
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [docReqLabel, setDocReqLabel] = useState('');
  const [docReqSending, setDocReqSending] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [dlTitle, setDlTitle] = useState('');
  const [dlStart, setDlStart] = useState('');
  const [dlDays, setDlDays] = useState(0);
  const [dlNotes, setDlNotes] = useState('');

  const comp = completeness(props, deadlines, lawyerPayments);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/deadlines?caseId=${encodeURIComponent(id)}`);
        if (!r.ok) return;
        const data = await r.json();
        setDeadlines((Array.isArray(data.deadlines) ? data.deadlines : []).map((d: any) => ({
          id: d.id, title: d.title,
          startDate: new Date(d.startDate).toISOString(),
          dueDate: new Date(d.dueDate).toISOString(),
          termDays: d.termDays, status: d.status,
        })));
      } catch {}
    })();
  }, [id]);

  function flash(msg: string) { setInfo(msg); setTimeout(() => setInfo(''), 3000); }

  async function save() {
    const res = await fetch(`/api/cases/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: localPriority, status: localStatus, matter, facts: localFacts }),
    });
    flash(res.ok ? 'Cambios guardados' : 'Error guardando');
  }

  async function saveNote() {
    const t = nextNote.trim();
    if (!t) return;
    const updated = [...lawyerNotes, t];
    const obj = { ...(notesObj || {}), lawyerNotes: updated };
    setLawyerNotes(updated); setNextNote('');
    await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: JSON.stringify(obj) }) });
    flash('Nota guardada');
  }

  async function deleteNote(i: number) {
    const arr = lawyerNotes.filter((_, j) => j !== i);
    const obj = { ...(notesObj || {}), lawyerNotes: arr };
    setLawyerNotes(arr);
    await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: JSON.stringify(obj) }) });
  }

  async function baja() {
    if (!window.confirm('¿Dar de baja este expediente?')) return;
    const r = await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) location.href = '/mis-casos';
    else flash('No se pudo dar de baja');
  }

  async function addDeadline() {
    if (!dlTitle || !dlStart) { flash('Completa título y fecha'); return; }
    const r = await fetch('/api/deadlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: id, title: dlTitle, startDate: dlStart, termDays: dlDays, notes: dlNotes }) });
    if (r.ok) {
      setDlOpen(false); setDlTitle(''); setDlStart(''); setDlDays(0); setDlNotes('');
      const rr = await fetch(`/api/deadlines?caseId=${encodeURIComponent(id)}`);
      const dd = await rr.json().catch(() => ({}));
      setDeadlines((Array.isArray(dd.deadlines) ? dd.deadlines : []).map((x: any) => ({ id: x.id, title: x.title, startDate: new Date(x.startDate).toISOString(), dueDate: new Date(x.dueDate).toISOString(), termDays: x.termDays, status: x.status })));
      flash('Plazo registrado');
    } else flash('Error registrando plazo');
  }

  async function uploadForConcept(concept: string, file: File) {
    const fd = new FormData();
    fd.set('caseId', id); fd.set('concept', concept); fd.set('file', file);
    const r = await fetch('/api/cases/upload', { method: 'POST', body: fd });
    if (r.ok) { flash(`Documento cargado: ${file.name}`); location.reload(); }
    else flash('Error subiendo archivo');
  }

  async function sendChat() {
    const msg = chatText.trim();
    if (!msg) return;
    setChatSending(true);
    try {
      const r = await fetch('/api/cases/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: id, message: msg }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.event) {
        setChatEvents(prev => [
          ...prev,
          {
            ...data.event,
            createdAt: data.event?.createdAt ? new Date(data.event.createdAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
          },
        ]);
        setChatText('');
        flash('Mensaje enviado');
      } else {
        flash(data.error || 'No se pudo enviar');
      }
    } finally {
      setChatSending(false);
    }
  }

  async function requestDocument() {
    const lbl = docReqLabel.trim();
    if (!lbl) return;
    setDocReqSending(true);
    try {
      const r = await fetch('/api/cases/request-document', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: id, label: lbl }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setChatEvents(prev => [
          ...prev,
          {
            id: `local_${Date.now()}`,
            type: 'CHAT',
            from: userName || 'Abogado',
            to: client?.email || '',
            message: `Solicitud de documento: ${lbl}`,
            createdAt: new Date().toLocaleString('es-MX'),
          },
        ]);
        setDocReqLabel('');
        flash('Solicitud enviada');
      } else {
        flash(data.error || 'No se pudo solicitar');
      }
    } finally {
      setDocReqSending(false);
    }
  }

  const byConcept = new Map<string, { id: string; createdAt: string; originalName: string; mimeType?: string | null }>();
  for (const a of attachments) { if (a.concept) byConcept.set(a.concept, { id: a.id, createdAt: a.createdAt, originalName: a.originalName, mimeType: a.mimeType || null }); }

  const totalPagadoAbogado = lawyerPayments
    .filter(payment => payment.status === 'CONFIRMADO')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const honorarios = honorarioAbogado == null ? null : Number(honorarioAbogado);
  const saldo = honorarios == null ? null : Math.max(honorarios - totalPagadoAbogado, 0);

  const inputSt: React.CSSProperties = { width: '100%', background: '#ffffff', border: `1px solid ${C.borderInput}`, borderRadius: 8, padding: '10px 14px', color: C.body, fontSize: 13, fontFamily: 'Georgia, serif' };
  const cardSt: React.CSSProperties = { background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24, marginBottom: 20 };
  const labelSt: React.CSSProperties = { fontSize: 11, color: C.faint, textTransform: 'uppercase' as const, letterSpacing: 1, display: 'block', marginBottom: 6 };
  const btnPrimary: React.CSSProperties = { background: C.btnPrimary, border: 'none', borderRadius: 8, padding: '10px 24px', color: C.btnPrimaryText, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 20px', color: C.muted, fontSize: 13, cursor: 'pointer' };

  return (
    <AppLayout userName={userName}>
      <Head><title>{expediente} – Abogados IA</title></Head>

      <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 20 }}>
          <Link href="/mis-casos" style={{ color: C.faint, textDecoration: 'none' }}>Expedientes</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: C.muted }}>{expediente}</span>
        </div>

        {/* Header del caso */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 2 }}>Expediente {expediente}</div>
                {expedienteReal && <div style={{ fontSize: 11, color: C.muted, background: '#f5f5f5', border: `1px solid ${C.border}`, padding: '2px 10px', borderRadius: 20 }}>No. Judicial {expedienteReal}</div>}
                {estadoAsignacion && <div style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: estadoAsignacion === 'ASIGNADO' ? C.greenBg : C.amberBg, color: estadoAsignacion === 'ASIGNADO' ? C.green : C.amber }}>{estadoAsignacion}</div>}
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.title, margin: '0 0 6px' }}>
                {client?.name?.toUpperCase() || 'CASO'} <span style={{ color: C.faint, fontWeight: 400 }}>vs.</span> {counterparty?.toUpperCase() || '—'}
              </h1>
              {intent && <p style={{ color: C.muted, marginTop: 0, marginBottom: 6, fontSize: 13 }}>{intent}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 20px', fontSize: 12, color: C.muted, marginBottom: 12 }}>
                <div><span style={{ color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Materia · </span>{matter || '—'}</div>
                <div><span style={{ color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Ciudad · </span>{ciudad || '—'}</div>
                <div><span style={{ color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Juzgado · </span>{[courtType, courtNumber].filter(Boolean).join(' ') || '—'}</div>
                {client?.phone && <div><span style={{ color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Tel · </span>{client.phone}</div>}
                {client?.email && <div><span style={{ color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Email · </span>{client.email}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                {(() => {
                  const st = STATUS_PRO_STYLE[status] || { label: status || '—', color: '#6b6b6b', bg: '#f5f5f5' };
                  return <>
                    <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: localPriority === 'URGENTE' ? C.redBg : C.blueBg, color: localPriority === 'URGENTE' ? C.red : C.blue, fontWeight: 600 }}>
                      {localPriority}
                    </span>
                    <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.color}22`, fontWeight: 600 }}>
                      {st.label}
                    </span>
                    <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#f5f5f5', color: C.muted }}>
                      {matter}
                    </span>
                  </>;
                })()}
                {knowledge.length > 0 && <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: C.tealBg, color: C.teal, fontWeight: 600 }}>✓ {knowledge.length} ref. jurídicas</span>}
              </div>
              {/* Próximo vencimiento destacado */}
              {proximoVencimiento && (() => {
                const alert = computeDeadlineAlert(proximoVencimiento.dueDateISO, proximoVencimiento.status);
                const stylesByVariant: Record<string, { bg: string; border: string; color: string }> = {
                  red:   { bg: C.redBg,   border: '1px solid rgba(192,57,43,0.3)',  color: C.red },
                  amber: { bg: C.amberBg, border: '1px solid rgba(180,83,9,0.3)',   color: C.amber },
                  blue:  { bg: C.blueBg,  border: '1px solid rgba(26,109,194,0.3)', color: C.blue },
                  green: { bg: C.greenBg, border: '1px solid rgba(34,160,107,0.3)', color: C.green },
                  gray:  { bg: '#f5f5f5', border: '1px solid #e5e5e5',              color: C.muted },
                  muted: { bg: C.blueBg,  border: '1px solid rgba(26,109,194,0.18)',color: '#0e7490' },
                };
                const s = stylesByVariant[alert.variant] || stylesByVariant.muted;
                return (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, background: s.bg, border: s.border, color: s.color, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div style={{ fontWeight: 600 }}>Próximo vencimiento · {proximoVencimiento.title}{alert.label ? ` · ${alert.label}` : ''}</div>
                  <div style={{ marginLeft: 'auto', fontWeight: 600 }}>{proximoVencimiento.dueDate}</div>
                </div>
                );
              })()}
            </div>

            {/* Indicador de completitud */}
            <div style={{ minWidth: 160, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: comp.pct === 100 ? C.green : comp.pct >= 60 ? C.blue : C.amber }}>
                {comp.pct}%
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginBottom: 8 }}>completitud</div>
              <div style={{ background: '#f0f0f0', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                <div style={{ background: comp.pct === 100 ? C.green : comp.pct >= 60 ? C.blue : C.amber, height: '100%', width: `${comp.pct}%`, borderRadius: 20, transition: 'width 0.4s' }} />
              </div>
              <div style={{ marginTop: 10, textAlign: 'left' }}>
                {comp.checks.map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: c.ok ? C.green : '#ccc' }}>{c.ok ? '●' : '○'}</span>
                    <span style={{ fontSize: 11, color: c.ok ? C.muted : C.faint }}>{c.label}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${C.border}` }}>
                  <span style={{ fontSize: 10, color: knowledge.length > 0 ? C.teal : '#ccc' }}>{knowledge.length > 0 ? '●' : '○'}</span>
                  <span style={{ fontSize: 11, color: knowledge.length > 0 ? C.teal : C.faint }}>Ref. jurídicas precargadas</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje de estado */}
        {info && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: C.green }}>
            {info}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              color: activeTab === tab ? C.activeTab : C.faint,
              fontSize: 13, cursor: 'pointer', fontFamily: 'Georgia, serif',
              borderBottom: activeTab === tab ? `2px solid ${C.title}` : '2px solid transparent',
              marginBottom: -1, fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* TAB: Hechos */}
        {activeTab === 'hechos' && (
          <div style={cardSt}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.title, marginBottom: 16 }}>Hechos del caso</div>
            <textarea
              rows={10}
              placeholder="Detalla los hechos del caso con la mayor precisión posible..."
              value={localFacts}
              onChange={e => setLocalFacts(e.target.value)}
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.7 }}
            />
            <div style={{ marginTop: 16 }}>
              <button onClick={save} style={btnPrimary}>Guardar hechos</button>
            </div>
          </div>
        )}

        {/* TAB: Documentos */}
        {activeTab === 'documentos' && (
          <div style={cardSt}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.title, marginBottom: 20 }}>Documentos por etapa procesal</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Etapa', 'Fecha', 'Documento'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {concepts.map((c, i) => {
                  const att = byConcept.get(c.key);
                  const isDemanda = c.key === 'DEMANDA';
                  const attDraft = isDemanda ? byConcept.get('DEMANDA_BORRADOR') : null;
                  const attExport = isDemanda ? byConcept.get('DEMANDA') : null;
                  const fecha = isDemanda
                    ? (attDraft ? new Date(attDraft.createdAt).toLocaleDateString() : (attExport ? new Date(attExport.createdAt).toLocaleDateString() : null))
                    : (att ? new Date(att.createdAt).toLocaleDateString() : null);
                  return (
                    <tr key={c.key} style={{ borderBottom: i < concepts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <td style={{ padding: '14px', fontSize: 13, color: C.body }}>{c.label}</td>
                      <td style={{ padding: '14px' }}>
                        {fecha
                          ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: C.greenBg, color: C.green }}>{fecha}</span>
                          : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f5f5f5', color: C.faint }}>Pendiente</span>
                        }
                      </td>
                      <td style={{ padding: '14px' }}>
                        {isDemanda ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(attDraft || !attExport) && (
                              <Link href={`/demandas/${encodeURIComponent(id)}/editor`} style={{ background: C.btnPrimary, borderRadius: 6, padding: '6px 14px', color: '#fff', fontSize: 12, textDecoration: 'none' }}>
                                {attDraft ? 'Editar' : 'Redactar'}
                              </Link>
                            )}
                            {attExport && (
                              <Link href={`/api/cases/download?id=${encodeURIComponent(attExport.id)}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', color: C.muted, fontSize: 12, textDecoration: 'none' }}>
                                Descargar
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {att && (
                              <Link href={`/api/cases/download?id=${encodeURIComponent(att.id)}`} style={{ fontSize: 12, color: C.blue, textDecoration: 'none' }}>
                                {att.originalName || 'Ver'}
                              </Link>
                            )}
                            <label style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                              {att ? 'Reemplazar' : 'Subir'}
                              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) uploadForConcept(c.key, f); e.currentTarget.value = ''; }} style={{ display: 'none' }} />
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {attachments.filter(a => !a.concept).length > 0 && (
              <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Otros documentos</div>
                {attachments.filter(a => !a.concept).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid #f5f5f5` }}>
                    <span style={{ fontSize: 13, color: C.body }}>{a.originalName}</span>
                    <Link href={`/api/cases/download?id=${encodeURIComponent(a.id)}`} style={{ fontSize: 12, color: C.blue, textDecoration: 'none' }}>Descargar</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Plazos */}
        {activeTab === 'plazos' && (() => {
          const alertBg: Record<string, string> = {
            red: C.redBg, amber: C.amberBg, blue: C.blueBg, green: C.greenBg, gray: '#f5f5f5', muted: '#f5f5f5',
          };
          const alertColor: Record<string, string> = {
            red: C.red, amber: C.amber, blue: C.blue, green: C.green, gray: C.faint, muted: C.faint,
          };
          const alertBorder: Record<string, string> = {
            red: '1px solid rgba(192,57,43,0.25)',
            amber: '1px solid rgba(180,83,9,0.25)',
            blue: '1px solid rgba(26,109,194,0.25)',
            green: '1px solid rgba(34,160,107,0.25)',
            gray: '1px solid #e5e5e5',
            muted: '1px solid #e5e5e5',
          };
          const rowsWithMeta = deadlines.map(d => ({
            ...d,
            computed: computeDeadlineStatus(d.dueDate, d.status) as ComputedDeadlineStatus,
            alert: computeDeadlineAlert(d.dueDate, d.status),
            startFmt: new Date(d.startDate).toLocaleDateString('es-MX'),
            dueFmt: new Date(d.dueDate).toLocaleDateString('es-MX'),
          }));
          const vencidos = rowsWithMeta.filter(r => r.computed === 'VENCIDO');
          const resto = rowsWithMeta.filter(r => r.computed !== 'VENCIDO');

          function renderRows(list: typeof rowsWithMeta) {
            if (list.length === 0) return null;
            return list.map((d, i) => {
              const chipLabel = d.alert.label || (d.computed === 'PENDIENTE' ? 'Pendiente' : d.computed === 'CUMPLIDO' ? 'Cumplido' : d.computed === 'CANCELADO' ? 'Cancelado' : d.status);
              const v = d.computed === 'CUMPLIDO' ? 'green' : d.computed === 'CANCELADO' ? 'gray' : d.alert.variant;
              return (
                <tr key={d.id} style={{ borderBottom: i < list.length - 1 ? `1px solid ${C.border}` : 'none', background: d.computed === 'VENCIDO' ? 'rgba(192,57,43,0.03)' : undefined }}>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: C.body }}>{d.title}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: C.muted }}>{d.startFmt}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: C.muted }}>{d.termDays}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: d.computed === 'VENCIDO' ? C.red : C.body, fontWeight: d.computed === 'VENCIDO' ? 700 : 500 }}>{d.dueFmt}</td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: alertBg[v], color: alertColor[v], border: alertBorder[v], fontWeight: 600 }}>
                      {chipLabel}
                    </span>
                  </td>
                </tr>
              );
            });
          }

          return (
          <div style={cardSt}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.title }}>Agenda y Plazos</div>
              <button onClick={() => setDlOpen(true)} style={btnPrimary}>+ Nuevo plazo</button>
            </div>
            {deadlines.length === 0 ? (
              <div style={{ color: C.faint, fontSize: 14, padding: '20px 0' }}>No hay plazos registrados.</div>
            ) : (
              <>
                {vencidos.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠</span> Plazos vencidos ({vencidos.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.red}30`, borderRadius: 8, overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: C.redBg }}>
                          {['Título', 'Notificación', 'Días', 'Vence', 'Alerta'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.red, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>{renderRows(vencidos)}</tbody>
                    </table>
                  </div>
                )}
                <div>
                  {vencidos.length > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10 }}>Resto de plazos</div>}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Título', 'Notificación', 'Días', 'Vence', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{renderRows(resto)}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          );
        })()}

        {/* TAB: Referencias Jurídicas (CaseKnowledge) */}
        {activeTab === 'referencias' && (
          <div style={cardSt}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.title, marginBottom: 6 }}>Referencias Jurídicas Utilizadas</div>
                <div style={{ fontSize: 12, color: C.faint }}>
                  Artículos, códigos y fragmentos normativos precargados vinculados a este expediente. Se alimentan desde el cuestionario inicial, la redacción de la demanda o el guardado de Hechos.
                </div>
              </div>
              {knowledge.length > 0 && (
                <Link href={`/demandas/${encodeURIComponent(id)}/editor`} style={{ background: C.tealBg, color: C.teal, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Ver todas en Editor de demanda →
                </Link>
              )}
            </div>

            {knowledge.length === 0 ? (
              <div style={{ border: `1px dashed ${C.border}`, background: '#fafafa', borderRadius: 10, padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12, color: '#cbd5e1' }}>⚖️</div>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Sin referencias jurídicas precargadas</div>
                <div style={{ fontSize: 12, color: C.faint, maxWidth: 520, margin: '0 auto 18px', lineHeight: 1.7 }}>
                  Para generarlas puedes: <b>(1)</b> guardar los Hechos del expediente en la pestaña correspondiente — se lanzará una búsqueda RAG sobre CC, CPC y Código Nacional; <b>(2)</b> ir a <i>Redactar demanda</i> donde el editor muestra en la barra lateral el matching de artículos aplicables al caso según la materia.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveTab('hechos')} style={btnSecondary}>Ir a Hechos</button>
                  <Link href={`/demandas/${encodeURIComponent(id)}/preparar`} style={btnPrimary}>Redactar demanda</Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {knowledge.map((k, i) => {
                  const source = k.sourceType || k.document?.sourceType || '';
                  const title = k.document?.title || (k.legalProvision?.designation ? k.legalProvision.designation : 'Referencia sin título');
                  const docMatter = k.document?.matter ? ` · ${k.document.matter}${k.document.submatter ? ` / ${k.document.submatter}` : ''}` : '';
                  const scorePct = typeof k.score === 'number' ? Math.round(k.score * 100) : null;
                  return (
                    <details key={k.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 0, background: '#ffffff' }}>
                      <summary style={{ cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
                        <span style={{ fontSize: 11, color: C.faint, minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: C.title, fontWeight: 600 }}>{title}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            {source && <span style={{ background: C.tealBg, color: C.teal, padding: '1px 8px', borderRadius: 20, marginRight: 8, fontWeight: 600 }}>{source}</span>}
                            Fecha: {k.createdAt}{docMatter}
                          </div>
                        </div>
                        {scorePct != null && (
                          <span style={{ fontSize: 11, background: scorePct >= 80 ? C.greenBg : scorePct >= 60 ? C.amberBg : '#f5f5f5', color: scorePct >= 80 ? C.green : scorePct >= 60 ? C.amber : C.faint, padding: '3px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            Score {scorePct}%
                          </span>
                        )}
                      </summary>
                      <div style={{ padding: '14px 16px 16px 50px', borderTop: `1px dashed ${C.border}`, background: '#fafafa' }}>
                        {k.snippet ? (
                          <p style={{ fontSize: 13, color: C.body, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{k.snippet}</p>
                        ) : (
                          <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>Sin texto disponible en esta referencia.</p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: Notas */}
        {activeTab === 'notas' && (
          <div style={cardSt}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.title, marginBottom: 16 }}>Notas del Abogado</div>
            {lawyerNotes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {lawyerNotes.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.faint, minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ flex: 1, fontSize: 14, color: C.body, lineHeight: 1.6 }}>{t}</span>
                    <button onClick={() => deleteNote(i)} style={{ background: 'transparent', border: 'none', color: C.faint, fontSize: 14, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <label style={labelSt}>Nueva nota</label>
            <textarea rows={4} placeholder="Escribe tu nota..." value={nextNote} onChange={e => setNextNote(e.target.value)} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={saveNote} style={{ ...btnPrimary, marginTop: 12 }}>Guardar nota</button>
          </div>
        )}

        {/* TAB: Chat */}
        {activeTab === 'chat' && (
          <div style={cardSt}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.title }}>Chat con cliente</div>
              <div style={{ fontSize: 12, color: C.faint }}>Copia a administración por correo</div>
            </div>

            {chatEvents.length === 0 ? (
              <div style={{ color: C.faint, fontSize: 13, padding: '6px 0 18px' }}>Aún no hay mensajes.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
                {chatEvents.map((ev: any) => (
                  <div key={ev.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: C.muted }}>{ev.from || '—'}{ev.to ? ` → ${ev.to}` : ''}</div>
                      <div style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{ev.createdAt}</div>
                    </div>
                    <div style={{ fontSize: 13, color: C.body, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ev.message || '—'}</div>
                  </div>
                ))}
              </div>
            )}

            <label style={labelSt}>Nuevo mensaje</label>
            <textarea rows={4} value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Escribe tu mensaje para el cliente..." style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={sendChat} disabled={chatSending} style={{ ...btnPrimary, opacity: chatSending ? 0.7 : 1, cursor: chatSending ? 'not-allowed' : 'pointer' }}>
                Enviar
              </button>
              <button onClick={() => setChatText('')} style={btnSecondary}>Limpiar</button>
            </div>

            <div style={{ height: 1, background: C.border, margin: '18px 0' }} />

            <label style={labelSt}>Solicitar documento</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={docReqLabel} onChange={e => setDocReqLabel(e.target.value)} placeholder="Ej: Acta de nacimiento del menor" style={{ ...inputSt, flex: 1 }} />
              <button onClick={requestDocument} disabled={docReqSending} style={{ ...btnSecondary, opacity: docReqSending ? 0.7 : 1, cursor: docReqSending ? 'not-allowed' : 'pointer' }}>
                Solicitar
              </button>
            </div>
          </div>
        )}

        {/* TAB: Honorarios del abogado */}
        {activeTab === 'cobranza' && (
          <>
            {/* Resumen exclusivo de honorarios del abogado. No expone cobros del cliente. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Honorario acordado', value: honorarios == null ? 'Pendiente' : `$${honorarios.toLocaleString('es-MX')}`, color: C.blue },
                { label: 'Pagado por PRO', value: `$${totalPagadoAbogado.toLocaleString('es-MX')}`, color: C.green },
                { label: 'Saldo por liquidar', value: saldo == null ? '—' : `$${saldo.toLocaleString('es-MX')}`, color: (saldo || 0) > 0 ? C.amber : C.green },
              ].map(s => (
                <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={cardSt}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.title }}>Pagos de PRO al abogado</div>
                <div style={{ fontSize: 12, color: C.faint }}>Registrados por administración</div>
              </div>

              {lawyerPayments.length === 0 ? (
                <div style={{ color: C.faint, fontSize: 14, padding: '10px 0' }}>Sin pagos registrados aún.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Fecha', 'Método', 'Referencia', 'Estado', 'Monto'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lawyerPayments.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: i < lawyerPayments.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: C.muted }}>{p.paidAt}</td>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: C.body }}>{p.method}</td>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: C.muted }}>{p.reference || '—'}</td>
                        <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 600, color: p.status === 'ANULADO' ? C.red : C.green }}>{p.status}</td>
                        <td style={{ padding: '13px 14px', fontSize: 14, fontWeight: 600, color: p.status === 'ANULADO' ? C.red : C.green }}>${Number(p.amount).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* TAB: Timeline */}
        {activeTab === 'timeline' && (() => {
          const typeLabel: Record<string, string> = {
            STATUS: 'Estado',
            PRIORITY: 'Prioridad',
            ATTACHMENT: 'Documento',
            FEE: 'Honorarios',
            CONTEXT: 'Contexto',
            NOTE: 'Nota',
            ACTUACION: 'Actuación',
            ACUERDO: 'Acuerdo',
            PROMOCION: 'Promoción',
            AUDIENCIA: 'Audiencia (registro operativo simple)',
            HONORARIO_ACORDADO: 'Honorario acordado',
            HONORARIO_MODIFICADO: 'Honorario modificado',
            HONORARIO_LIMPIADO_REASIGNACION: 'Honorario limpiado por reasignación',
            PAGO_ABOGADO: 'Pago al abogado',
            PAGO_ABOGADO_ANULADO: 'Pago al abogado anulado',
          };
          const typeColor: Record<string, string> = {
            STATUS: C.blue,
            PRIORITY: C.amber,
            ATTACHMENT: C.green,
            FEE: C.muted,
            CONTEXT: C.faint,
            NOTE: C.faint,
            ACTUACION: C.teal,
            ACUERDO: C.green,
            PROMOCION: C.blue,
            AUDIENCIA: C.red,
            HONORARIO_ACORDADO: C.blue,
            HONORARIO_MODIFICADO: C.amber,
            HONORARIO_LIMPIADO_REASIGNACION: C.muted,
            PAGO_ABOGADO: C.green,
            PAGO_ABOGADO_ANULADO: C.red,
          };

          // Filtrar: omitir NOTE con JSON crudo y deduplicar consecutivos con mismo tipo+mensaje
          // Invertir para orden cronológico ASC (viejo → nuevo), ya que SSR trae DESC
          const filtered = [...events]
            .reverse()
            .filter(ev => {
              if (ev.type === 'NOTE' && ev.message?.startsWith('{')) return false;
              return true;
            })
            .filter((ev, i, arr) => {
              if (i === 0) return true;
              const prev = arr[i - 1];
              return !(prev.type === ev.type && prev.message === ev.message && prev.from === ev.from && prev.to === ev.to);
            });

          return (
            <div style={cardSt}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.title }}>Historial del expediente</div>
                <div style={{ fontSize: 11, color: C.faint }}>Orden cronológico · Tipos procesales: Actuación, Acuerdo, Promoción, Audiencia</div>
              </div>
              {filtered.length === 0 ? (
                <div style={{ color: C.faint, fontSize: 14, padding: '10px 0' }}>Sin eventos registrados.</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 28 }}>
                  <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 1, background: C.border }} />
                  {filtered.map(ev => {
                    const col = typeColor[ev.type] || C.muted;
                    const label = typeLabel[ev.type] || ev.type;
                    return (
                      <div key={ev.id} style={{ position: 'relative', marginBottom: 20 }}>
                        <div style={{ position: 'absolute', left: -24, top: 4, width: 10, height: 10, borderRadius: '50%', background: col, border: `2px solid ${C.card}` }} />
                        <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{ev.createdAt}</div>
                        <div style={{ fontSize: 13, color: C.body, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: col }}>{label}</span>
                          {ev.from && ev.to && <span style={{ color: C.muted }}>{ev.from} → {ev.to}</span>}
                          {ev.message && !(ev.from && ev.to) && <span style={{ color: C.muted }}>{ev.message}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Acciones del expediente */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={`/mis-casos`} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', color: C.muted, fontSize: 12, textDecoration: 'none' }}>
              ← Volver
            </Link>
            <button onClick={baja} style={{ background: 'transparent', border: `1px solid rgba(192,57,43,0.25)`, borderRadius: 8, padding: '8px 16px', color: C.red, fontSize: 12, cursor: 'pointer' }}>
              Dar de baja
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {knowledge.length > 0 && <Link href={`/demandas/${encodeURIComponent(id)}/editor`} style={{ background: C.tealBg, color: C.teal, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '9px 20px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Abrir editor</Link>}
            <Link href={`/demandas/${encodeURIComponent(id)}/preparar`} style={{ background: C.btnPrimary, borderRadius: 8, padding: '11px 26px', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              {userRole === 'ABOGADO' ? '⚖️  Redactar demanda' : 'Ir a demanda'}
            </Link>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo plazo */}
      {dlOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, width: 'min(500px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.title }}>Nuevo plazo</div>
              <button onClick={() => setDlOpen(false)} style={{ background: 'transparent', border: 'none', color: C.faint, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            {[['Título', dlTitle, setDlTitle, 'text'], ['Fecha de notificación', dlStart, setDlStart, 'date']].map(([lbl, val, setter, type]) => (
              <div key={lbl as string} style={{ marginBottom: 14 }}>
                <label style={labelSt}>{lbl as string}</label>
                <input type={type as string} value={val as string} onChange={e => (setter as Function)(e.target.value)} style={inputSt} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Días de término</label>
              <input type="number" min={0} value={dlDays} onChange={e => setDlDays(Number(e.target.value || 0))} style={inputSt} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Notas (opcional)</label>
              <textarea rows={2} value={dlNotes} onChange={e => setDlNotes(e.target.value)} style={{ ...inputSt, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addDeadline} style={btnPrimary}>Guardar</button>
              <button onClick={() => setDlOpen(false)} style={btnSecondary}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  try {
    const auth = getAuthFromCookies(req.headers.cookie);
    if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return { redirect: { destination: '/login', permanent: false } };
    const id = String(params?.id || '');
    if (!id) return { redirect: { destination: '/mis-casos', permanent: false } };

    const lc: any = await (prisma as any).legalCase.findUnique({
      where: { id },
      include: {
        client: true,
        attachments: { orderBy: { createdAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' } },
        lawyerPayments: { orderBy: { paidAt: 'desc' } },
        deadlines: { where: { status: 'PENDIENTE' }, orderBy: { dueDate: 'asc' }, take: 3, select: { id: true, title: true, dueDate: true, status: true } },
        knowledge: {
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          include: {
            document: { select: { id: true, title: true, sourceType: true, matter: true, submatter: true } },
            legalProvision: { select: { id: true, designation: true, type: true } },
          },
        },
      },
    });
    if (!canAccessLegalCase(auth, lc, true)) return { redirect: { destination: '/mis-casos', permanent: false } };

    const user = await prisma.user.findUnique({ where: { id: auth.uid }, select: { name: true } });
    const nextDl = (lc?.deadlines?.[0] as any) || null;

    return {
      props: {
        id: lc.id,
        expediente: lc.expediente,
        counterparty: lc.counterparty || null,
        intent: lc.intent || null,
        facts: lc.facts || null,
        courtNumber: lc.courtNumber || null,
        courtType: lc.courtType || null,
        matter: lc.matter,
        type: lc.type,
        priority: lc.priority,
        status: lc.status,
        notes: lc.notes || null,
        honorarioAbogado: lc.honorarioAbogado ?? null,
        questionnaireData: lc.questionnaireData || null,
        userName: user?.name || '',
        userRole: auth.role,
        ciudad: lc.ciudad || null,
        expedienteReal: lc.expedienteReal || null,
        estadoAsignacion: lc.estadoAsignacion || null,
        proximoVencimiento: nextDl ? { id: String(nextDl.id), title: String(nextDl.title), dueDate: new Date(nextDl.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }), dueDateISO: new Date(nextDl.dueDate).toISOString(), status: String(nextDl.status || 'PENDIENTE') } : null,
        client: lc.client ? { id: lc.client.id, name: lc.client.name, phone: lc.client.phone || null, email: lc.client.email || null, address: lc.client.address || null } : null,
        attachments: lc.attachments.map((a: any) => ({ id: a.id, originalName: a.originalName, concept: a.concept || null, createdAt: a.createdAt.toISOString(), mimeType: a.mimeType || null })),
        events: lc.events.map((e: any) => ({ id: e.id, type: e.type, from: e.from || null, to: e.to || null, message: e.message || null, createdAt: new Date(e.createdAt).toLocaleString('es-MX') })),
        initialLawyerPayments: lc.lawyerPayments
          .filter((p: any) => auth.role === 'ADMIN' || p.lawyerId === auth.uid)
          .map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paidAt: new Date(p.paidAt).toLocaleDateString('es-MX'),
            method: p.method,
            reference: p.reference || null,
            status: p.status,
            voidReason: p.voidReason || null,
          })),
        knowledge: lc.knowledge.map((k: any) => ({
          id: k.id,
          caseId: k.caseId,
          documentId: k.documentId || null,
          snippet: k.snippet || null,
          score: typeof k.score === 'number' ? Number(k.score) : null,
          sourceType: k.sourceType || null,
          createdAt: new Date(k.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
          document: k.document ? { id: k.document.id, title: k.document.title, sourceType: k.document.sourceType || null, matter: k.document.matter || null, submatter: k.document.submatter || null } : null,
          legalProvision: k.legalProvision ? { id: k.legalProvision.id, designation: k.legalProvision.designation || null, type: k.legalProvision.type || null } : null,
        })),
      },
    };
  } catch (e: any) {
    console.error('mis-casos/[id] SSR error:', e?.message || e);
    return { redirect: { destination: '/mis-casos', permanent: false } };
  }
};
