import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';
import AppLayout from '../../components/AppLayout';

type Row = {
  id: string;
  expediente: string;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  counterparty: string;
  counterpartyAddress: string | null;
  intent: string | null;
  priority: string;
  status: string;
  createdAt: string;
  matter: string;
  ciudad: string | null;
  courtNumber: string | null;
  courtType: string | null;
  expedienteReal: string | null;
  estadoAsignacion: string | null;
  proximoVencimiento: { id: string; title: string; dueDate: string; status: string } | null;
  abogadoId: string | null;
};

const STATUS_PRO_LABEL: Record<string, string> = {
  NUEVO: 'Nuevo',
  ASIGNADO: 'Asignado',
  EN_REVISION: 'En revisión',
  EN_REDACCION: 'En redacción',
  DEMANDA_LISTA: 'Demanda lista',
  PRESENTADO: 'Presentado',
  SEGUIMIENTO: 'Seguimiento',
  CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado',
};
const STATUS_PRO_MAP: Record<string, { label: string; color: string; bg: string }> = {
  NUEVO:         { label: STATUS_PRO_LABEL.NUEVO,         color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)' },
  ASIGNADO:      { label: STATUS_PRO_LABEL.ASIGNADO,      color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  EN_REVISION:   { label: STATUS_PRO_LABEL.EN_REVISION,   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  EN_REDACCION:  { label: STATUS_PRO_LABEL.EN_REDACCION,  color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  DEMANDA_LISTA: { label: STATUS_PRO_LABEL.DEMANDA_LISTA, color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  PRESENTADO:    { label: STATUS_PRO_LABEL.PRESENTADO,    color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
  SEGUIMIENTO:   { label: STATUS_PRO_LABEL.SEGUIMIENTO,   color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  CERRADO:       { label: STATUS_PRO_LABEL.CERRADO,       color: '#4b5563', bg: 'rgba(75,85,99,0.10)' },
  ARCHIVADO:     { label: STATUS_PRO_LABEL.ARCHIVADO,     color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  BORRADOR:   { label: 'Borrador',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  PRESENTADA: { label: 'Presentada', color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  BAJA:       { label: 'Baja',       color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  ...STATUS_PRO_MAP,
};
const STATUS_FILTER_LIST = [
  'ALL',
  'NUEVO','ASIGNADO','EN_REVISION','EN_REDACCION','DEMANDA_LISTA',
  'PRESENTADO','SEGUIMIENTO','CERRADO','ARCHIVADO',
  'BORRADOR','PRESENTADA','BAJA'
] as const;

export default function Expedientes({ rows, userEmail }: { rows: Row[]; userEmail: string; userName: string }) {
  const [list, setList] = React.useState<Row[]>(rows);
  const [showAlta, setShowAlta] = React.useState(false);
  const [showPlantillas, setShowPlantillas] = React.useState(false);
  const [plantScope, setPlantScope] = React.useState<'PERSONAL' | 'SISTEMA' | 'TODAS'>('PERSONAL');
  const [templates, setTemplates] = React.useState<Array<{ id: string; title: string; matter: string; submatter?: string | null; scope: 'PERSONAL' | 'SISTEMA' }>>([]);
  const [editing, setEditing] = React.useState<{ id: string; priority: string; status: string; counterparty: string; counterpartyAddress: string; intent: string } | null>(null);
  const [clientEdit, setClientEdit] = React.useState<{ id?: string; name: string; email: string; phone: string; address: string }>({ name: '', email: '', phone: '', address: '' });
  const [editMsg, setEditMsg] = React.useState('');
  const [altaMsg, setAltaMsg] = React.useState('');
  const [alta, setAlta] = React.useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', counterparty: '', counterpartyAddress: '', intent: '', expediente: '', priority: 'NORMAL' });
  const [q, setQ] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<'ALL' | 'NORMAL' | 'URGENTE'>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_FILTER_LIST)[number]>('ALL');
  const [tplEdit, setTplEdit] = React.useState<{ id?: string; title: string; content: string; matter: string; submatter: string }>({ title: '', content: '', matter: 'CIVIL', submatter: '' });
  const [tplEditing, setTplEditing] = React.useState(false);
  const [tplMsg, setTplMsg] = React.useState('');
  const [selectingTpl, setSelectingTpl] = React.useState<{ id: string; title: string } | null>(null);
  const [targetCaseId, setTargetCaseId] = React.useState('');

  const input: React.CSSProperties = { width: '100%', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', color: '#1a1a1a', fontSize: 13 };
  const btn: React.CSSProperties = { background: '#4b4b4b', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };

  const filtered = React.useMemo(() => {
    return list.filter(r => {
      const text = (r.expediente + ' ' + (r.clientName || '') + ' ' + (r.counterparty || '')).toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [list, q, priorityFilter, statusFilter]);

  const counts = React.useMemo(() => ({
    total: list.length,
    urgentes: list.filter(r => r.priority === 'URGENTE').length,
    enProceso: list.filter(r => ['NUEVO','ASIGNADO','EN_REVISION','EN_REDACCION','BORRADOR'].includes(r.status)).length,
    presentadas: list.filter(r => ['PRESENTADO','PRESENTADA','DEMANDA_LISTA','SEGUIMIENTO'].includes(r.status)).length,
    bajas: list.filter(r => ['BAJA','CERRADO','ARCHIVADO'].includes(r.status)).length,
    sinAsignar: list.filter(r => !r.estadoAsignacion || r.estadoAsignacion !== 'ASIGNADO').length,
  }), [list]);

  function refreshList() { if (typeof window !== 'undefined') location.reload(); }

  async function saveAlta() {
    if (!alta.clientName.trim() || !alta.clientEmail.trim() || !alta.clientPhone.trim() || !alta.clientAddress.trim() || !alta.counterparty.trim() || !alta.counterpartyAddress.trim() || !alta.intent.trim()) {
      setAltaMsg('Completa los campos obligatorios (*)'); return;
    }
    setAltaMsg('');
    try {
      const r1 = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: alta.clientName, phone: alta.clientPhone || undefined, email: alta.clientEmail, address: alta.clientAddress || undefined }) });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok || !d1.id) { setAltaMsg('Error al crear cliente: ' + (d1.error || r1.status)); return; }
      const r2 = await fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: d1.id, matter: 'CIVIL', type: 'ORDINARIO', intent: alta.intent, expediente: alta.expediente || undefined, counterparty: alta.counterparty, counterpartyAddress: alta.counterpartyAddress || undefined, priority: alta.priority, status: 'BORRADOR' }) });
      const d2 = await r2.json().catch(() => ({}));
      if (r2.ok) {
        setShowAlta(false); setAltaMsg('');
        setAlta({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', counterparty: '', counterpartyAddress: '', intent: '', expediente: '', priority: 'NORMAL' });
        refreshList();
      } else { setAltaMsg('Error al crear expediente: ' + (d2.error || r2.status)); }
    } catch (e: any) { setAltaMsg('Error de red: ' + (e?.message || '')); }
  }

  async function loadTemplates(scope: 'PERSONAL' | 'SISTEMA' | 'TODAS') {
    try {
      const url = scope === 'PERSONAL' ? '/api/templates?scope=PERSONAL' : scope === 'SISTEMA' ? '/api/templates?scope=SISTEMA' : '/api/templates';
      const r = await fetch(url);
      const d = await r.json().catch(() => ({}));
      const arr = Array.isArray(d.templates) ? d.templates : Array.isArray(d.items) ? d.items : [];
      setTemplates(arr.map((t: any) => ({ id: String(t.id), title: String(t.title), matter: String(t.matter || 'CIVIL'), submatter: t.submatter || null, scope: t.scope || 'PERSONAL' })));
    } catch { setTemplates([]); }
  }

  React.useEffect(() => { if (showPlantillas) loadTemplates(plantScope); }, [showPlantillas, plantScope]);

  async function saveTemplate() {
    setTplMsg('');
    if (!tplEdit.title.trim() || !tplEdit.content.trim()) { setTplMsg('Título y contenido requeridos'); return; }
    try {
      const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tplEdit.id || undefined, title: tplEdit.title, content: tplEdit.content, matter: tplEdit.matter, submatter: tplEdit.submatter || undefined }) });
      if (r.ok) {
        setTplEditing(false);
        setTplEdit({ id: undefined, title: '', content: '', matter: 'CIVIL', submatter: '' });
        await loadTemplates(plantScope);
        setTplMsg('✓ Plantilla guardada');
        setTimeout(() => setTplMsg(''), 2000);
      } else {
        const d = await r.json().catch(() => ({}));
        setTplMsg(d.error || 'Error guardando plantilla');
      }
    } catch { setTplMsg('Error de red'); }
  }

  return (
    <AppLayout userName={userEmail} role="ABOGADO">
      <Head><title>Expedientes – Abogados IA</title></Head>
      <style jsx>{`
        .exp-card:hover { border-color: #9b9b9b !important; }
        .action-btn:hover { opacity: 0.85; }
        .filter-chip { transition: all 0.15s; cursor: pointer; }
        .filter-chip:hover { border-color: #9b9b9b !important; }
      `}</style>

      {/* ── Hero (Itaca pattern) ── */}
      <div style={{ padding: '56px 40px 48px', textAlign: 'center', borderBottom: '1px solid #e5e5e5' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#3d3d3d', margin: '0 0 8px' }}>Expedientes</h1>
        <p style={{ fontSize: 15, color: '#6b6b6b', margin: '0 0 40px' }}>Gestión inteligente de tus casos legales con IA</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 860, margin: '0 auto 40px' }}>
          {([
            {
              icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b4b4b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
              title: 'Centraliza tus casos',
              desc: 'Datos del cliente, contraparte y expediente en un solo lugar, siempre disponibles',
            },
            {
              icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b4b4b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
              title: 'Genera demandas con IA',
              desc: 'Cuestionario inteligente + artículos del CC/CPC generan tu demanda en minutos',
            },
            {
              icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b4b4b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              title: 'Controla tus plazos',
              desc: 'Fechas procesales vinculadas a cada expediente para que no pierdas ninguna',
            },
          ] as { icon: React.ReactNode; title: string; desc: string }[]).map(item => (
            <div key={item.title} style={{ background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 12, padding: '28px 20px' }}>
              <div style={{ marginBottom: 14 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3d3d3d', marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#6b6b6b', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 32 }}>
          <button
            style={{ background: '#4b4b4b', color: '#ffffff', border: 'none', borderRadius: 999, padding: '13px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            onClick={() => { setShowAlta(true); setAltaMsg(''); }}>
            + Nuevo Expediente
          </button>
          <button
            style={{ background: 'transparent', color: '#1a1a1a', border: '2px solid #d4d4d4', borderRadius: 999, padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setShowPlantillas(true)}>
            Ver Plantillas
          </button>
        </div>

        {/* Dos videos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 860, margin: '0 auto' }}>
          {[
            { label: 'Cómo hacer consultas en el Panel de IA' },
            { label: 'Cómo gestionar tus expedientes con Abogados IA, paso a paso' },
          ].map(v => (
            <div key={v.label} style={{ background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ background: '#ececec', height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#ffffff' }}>▶</div>
              </div>
              <div style={{ padding: '10px 14px', fontSize: 12, color: '#6b6b6b', textAlign: 'left' }}>{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '28px 40px' }}>

        {/* ── Métricas rápidas ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { label: 'Total',       value: counts.total       },
            { label: 'En proceso',  value: counts.enProceso   },
            { label: 'Urgentes',    value: counts.urgentes    },
            { label: 'Pte. demanda', value: counts.presentadas },
            { label: 'Cerrados',    value: counts.bajas       },
            { label: 'Sin asignar', value: counts.sinAsignar  },
          ].map(m => (
            <div key={m.label} style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, padding: '16px 24px', textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#3d3d3d', lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#9b9b9b', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, marginBottom: 24, alignItems: 'center' }}>
          <input
            placeholder="Buscar por expediente, cliente o contraparte..."
            value={q} onChange={e => setQ(e.target.value)}
            style={{ ...input }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...input, width: 'auto', padding: '10px 12px' }}>
            <option value="ALL">Todos los estatus</option>
            <optgroup label="Flujo PRO">
              <option value="NUEVO">Nuevo</option>
              <option value="ASIGNADO">Asignado</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="EN_REDACCION">En redacción</option>
              <option value="DEMANDA_LISTA">Demanda lista</option>
              <option value="PRESENTADO">Presentado</option>
              <option value="SEGUIMIENTO">Seguimiento</option>
              <option value="CERRADO">Cerrado</option>
              <option value="ARCHIVADO">Archivado</option>
            </optgroup>
            <optgroup label="Legacy">
              <option value="BORRADOR">Borrador</option>
              <option value="PRESENTADA">Presentada</option>
              <option value="BAJA">Baja</option>
            </optgroup>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} style={{ ...input, width: 'auto', padding: '10px 12px' }}>
            <option value="ALL">Todas las prioridades</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </div>

        {/* ── Grid de cards ── */}
        {rows.length === 0 ? (
          /* Empty state */
          <div style={{ background: '#f5f5f5', border: '1px dashed #d4d4d4', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Sin expedientes aún</div>
            <div style={{ fontSize: 14, color: '#6b6b6b', marginBottom: 24 }}>Registra tu primer expediente para empezar a gestionar tus casos con IA.</div>
            <button style={{ ...btn, padding: '12px 28px', fontSize: 14 }} onClick={() => { setShowAlta(true); setAltaMsg(''); }}>
              + Crear primer expediente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 12, padding: '40px', textAlign: 'center', color: '#9b9b9b', fontSize: 14 }}>
            Sin resultados para los filtros aplicados.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 14 }}>
            {filtered.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.BORRADOR;
              return (
                <div key={r.id} className="exp-card" style={{
                  background: '#ffffff', borderRadius: 12,
                  border: '1px solid #e5e5e5', padding: '18px 20px',
                  transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {/* Top row: expediente + badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#3d3d3d', letterSpacing: 0.5 }}>{r.expediente}</div>
                      {r.expedienteReal && <div style={{ fontSize: 11, color: '#6b6b6b', marginTop: 2 }}>No. J. {r.expedienteReal}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {r.priority === 'URGENTE' && (
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}>Urgente</span>
                      )}
                      {r.estadoAsignacion !== 'ASIGNADO' && !r.abogadoId && (
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(251,146,60,0.08)', color: '#ea580c', border: '1px solid rgba(251,146,60,0.25)', fontWeight: 700 }}>Sin asignar</span>
                      )}
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.color}33`, fontWeight: 700 }}>{st.label}</span>
                    </div>
                  </div>

                  {/* Partes */}
                  <div>
                    <div style={{ fontSize: 14, color: '#3d3d3d', fontWeight: 600 }}>{r.clientName}</div>
                    <div style={{ fontSize: 13, color: '#9b9b9b' }}>vs. {r.counterparty}</div>
                  </div>

                  {/* Datos operativos / judiciales */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 12, color: '#6b6b6b' }}>
                    <div><span style={{ color: '#9b9b9b' }}>Materia · </span>{r.matter || '—'}</div>
                    <div><span style={{ color: '#9b9b9b' }}>Ciudad · </span>{r.ciudad || '—'}</div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#9b9b9b' }}>Juzgado · </span>
                      {[r.courtType, r.courtNumber].filter(Boolean).join(' ') || '—'}
                    </div>
                  </div>

                  {/* Próximo vencimiento */}
                  {r.proximoVencimiento && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.18)', color: '#0e7490', borderRadius: 8, padding: '6px 10px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span style={{ fontWeight: 600 }}>{r.proximoVencimiento.title}</span>
                      <span style={{ marginLeft: 'auto' }}>{r.proximoVencimiento.dueDate}</span>
                    </div>
                  )}

                  {/* Intent */}
                  {r.intent && (
                    <div style={{ fontSize: 12, color: '#6b6b6b', background: '#f9f9f9', border: '1px solid #ebebeb', borderRadius: 6, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.intent}
                    </div>
                  )}

                  {/* Footer: fecha + acciones */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#9b9b9b' }}>{r.createdAt}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="action-btn"
                        style={{ background: 'transparent', color: '#6b6b6b', border: '1px solid #e0e0e0', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                        onClick={() => {
                          setEditing({ id: r.id, priority: r.priority, status: r.status, counterparty: r.counterparty || '', counterpartyAddress: r.counterpartyAddress || '', intent: r.intent || '' });
                          setClientEdit({ id: r.clientId || undefined, name: r.clientName || '', email: r.clientEmail || '', phone: r.clientPhone || '', address: r.clientAddress || '' });
                          setEditMsg('');
                        }}
                      >
                        Editar
                      </button>
                      <Link href={`/demandas/${encodeURIComponent(r.id)}/preparar`} className="action-btn" style={{ background: '#f5f5f5', color: '#1a1a1a', border: '1px solid #e0e0e0', borderRadius: 7, padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>
                        Demanda
                      </Link>
                      <Link href={`/mis-casos/${encodeURIComponent(r.id)}`} className="action-btn" style={{ background: '#4b4b4b', color: '#ffffff', borderRadius: 7, padding: '6px 12px', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>
                        Abrir →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Modal Alta ── */}
      {showAlta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 14, padding: 28, width: 'min(640px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#3d3d3d' }}>Nuevo Expediente</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Registra los datos del cliente y del caso</div>
              </div>
              <button onClick={() => { setShowAlta(false); setAltaMsg(''); }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 14, border: '1px solid #e5e5e5' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Datos del cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Nombre *</label><input style={input} value={alta.clientName} onChange={e => setAlta({ ...alta, clientName: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Correo *</label><input style={input} value={alta.clientEmail} onChange={e => setAlta({ ...alta, clientEmail: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Teléfono *</label><input style={input} value={alta.clientPhone} onChange={e => setAlta({ ...alta, clientPhone: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Domicilio *</label><input style={input} value={alta.clientAddress} onChange={e => setAlta({ ...alta, clientAddress: e.target.value })} placeholder="Calle, colonia, CP, ciudad" /></div>
                </div>
              </div>
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 14, border: '1px solid #e5e5e5' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Datos del expediente</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Nombre del demandado *</label><input style={input} value={alta.counterparty} onChange={e => setAlta({ ...alta, counterparty: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Domicilio de emplazamiento del demandado *</label><input style={input} value={alta.counterpartyAddress} onChange={e => setAlta({ ...alta, counterpartyAddress: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Lo que se demanda *</label><input style={input} value={alta.intent} onChange={e => setAlta({ ...alta, intent: e.target.value })} placeholder="Ej. Divorcio por mutuo acuerdo" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>No. expediente (opcional)</label><input style={input} value={alta.expediente} onChange={e => setAlta({ ...alta, expediente: e.target.value })} placeholder="Auto-generado si vacío" /></div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Prioridad</label>
                      <select style={{ ...input, padding: '10px 10px' }} value={alta.priority} onChange={e => setAlta({ ...alta, priority: e.target.value })}>
                        <option value="NORMAL">Normal</option>
                        <option value="URGENTE">Urgente</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {altaMsg && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>{altaMsg}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ ...btn }} onClick={saveAlta}>Guardar expediente</button>
                <button style={{ ...btn, background: '#f5f5f5', color: '#6b6b6b', border: '1px solid #e0e0e0' }} onClick={() => { setShowAlta(false); setAltaMsg(''); }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Plantillas ── */}
      {showPlantillas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 14, padding: 28, width: 'min(720px, 96vw)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3d3d3d' }}>Plantillas</div>
              <button onClick={() => setShowPlantillas(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <select value={plantScope} onChange={e => setPlantScope(e.target.value as any)} style={{ ...input, width: 220 }}>
                <option value="PERSONAL">Mis Plantillas</option>
                <option value="SISTEMA">Plantillas del Sistema</option>
                <option value="TODAS">Todas</option>
              </select>
              <button style={{ ...btn, background: '#0d1117', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.4)' }} onClick={() => loadTemplates(plantScope)}>Refrescar</button>
              <button style={btn} onClick={() => { setTplEditing(true); setTplEdit({ id: undefined, title: '', content: '', matter: 'CIVIL', submatter: '' }); }}>+ Añadir plantilla</button>
            </div>
            {tplMsg && <div style={{ background: tplMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tplMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: tplMsg.startsWith('✓') ? '#34d399' : '#ef4444' }}>{tplMsg}</div>}
            {tplEditing && (
              <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Título</label><input style={input} value={tplEdit.title} onChange={e => setTplEdit({ ...tplEdit, title: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Contenido</label><textarea style={{ ...input, height: 140, resize: 'vertical', fontFamily: 'monospace' }} value={tplEdit.content} onChange={e => setTplEdit({ ...tplEdit, content: e.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Materia</label><select style={{ ...input, padding: '10px 10px' }} value={tplEdit.matter} onChange={e => setTplEdit({ ...tplEdit, matter: e.target.value })}><option value="CIVIL">CIVIL</option></select></div>
                    <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Tipo (opcional)</label><input style={input} value={tplEdit.submatter} onChange={e => setTplEdit({ ...tplEdit, submatter: e.target.value })} placeholder="ALIMENTOS / DIVORCIO..." /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={{ ...btn, background: '#22c55e' }} onClick={saveTemplate}>Guardar</button>
                    <button style={{ ...btn, background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b' }} onClick={() => { setTplEditing(false); setTplMsg(''); }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
            {templates.length === 0 ? (
              <div style={{ fontSize: 14, color: '#64748b', padding: '20px 0' }}>No hay plantillas en este ámbito.</div>
            ) : (
              templates.map(t => (
                <div key={t.id} style={{ borderBottom: '1px solid #0d1117' }}>
                  <div style={{ padding: '12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: '#6b6b6b' }}>{t.matter}{t.submatter ? ` · ${t.submatter}` : ''}</div>
                    </div>
                    <button style={{ ...btn, padding: '6px 12px', fontSize: 12 }} onClick={() => { setSelectingTpl({ id: t.id, title: t.title }); setTargetCaseId(''); }}>Usar</button>
                  </div>
                  {selectingTpl?.id === t.id && (
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, margin: '0 0 10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>¿En qué expediente quieres usar esta plantilla?</div>
                      <select style={{ ...input, marginBottom: 10 }} value={targetCaseId} onChange={e => setTargetCaseId(e.target.value)}>
                        <option value="">— Selecciona un expediente —</option>
                        {list.map(c => <option key={c.id} value={c.id}>{c.expediente || c.id} · {c.clientName}{c.counterparty ? ` vs. ${c.counterparty}` : ''}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={targetCaseId ? `/demandas/${encodeURIComponent(targetCaseId)}/editor?templateId=${encodeURIComponent(selectingTpl.id)}` : '#'} style={{ ...btn, textDecoration: 'none', opacity: targetCaseId ? 1 : 0.4, pointerEvents: targetCaseId ? 'auto' : 'none' }} onClick={() => { if (targetCaseId) setShowPlantillas(false); }}>
                          Abrir en editor →
                        </Link>
                        <button style={{ ...btn, background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b' }} onClick={() => setSelectingTpl(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Modal Editar ── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 14, padding: 28, width: 'min(580px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3d3d3d' }}>Editar Expediente</div>
              <button onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {editMsg && <div style={{ background: editMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${editMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: editMsg.startsWith('✓') ? '#34d399' : '#ef4444' }}>{editMsg}</div>}
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 14, border: '1px solid #e5e5e5' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Datos del cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Nombre</label><input style={input} value={clientEdit.name} onChange={e => setClientEdit({ ...clientEdit, name: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Correo</label><input style={input} value={clientEdit.email} onChange={e => setClientEdit({ ...clientEdit, email: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Teléfono</label><input style={input} value={clientEdit.phone} onChange={e => setClientEdit({ ...clientEdit, phone: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Domicilio</label><input style={input} value={clientEdit.address} onChange={e => setClientEdit({ ...clientEdit, address: e.target.value })} /></div>
                </div>
              </div>
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 14, border: '1px solid #e5e5e5' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Datos del expediente</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Demandado</label><input style={input} value={editing.counterparty} onChange={e => setEditing({ ...editing, counterparty: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Domicilio de emplazamiento</label><input style={input} value={editing.counterpartyAddress} onChange={e => setEditing({ ...editing, counterpartyAddress: e.target.value })} /></div>
                  <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Lo que se demanda</label><input style={input} value={editing.intent} onChange={e => setEditing({ ...editing, intent: e.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Prioridad</label>
                      <select style={{ ...input, padding: '10px 10px' }} value={editing.priority} onChange={e => setEditing({ ...editing, priority: e.target.value })}>
                        <option value="NORMAL">Normal</option><option value="URGENTE">Urgente</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 }}>Estatus</label>
                      <select style={{ ...input, padding: '10px 10px' }} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                        <optgroup label="Flujo PRO">
                          <option value="NUEVO">Nuevo</option>
                          <option value="ASIGNADO">Asignado</option>
                          <option value="EN_REVISION">En revisión</option>
                          <option value="EN_REDACCION">En redacción</option>
                          <option value="DEMANDA_LISTA">Demanda lista</option>
                          <option value="PRESENTADO">Presentado</option>
                          <option value="SEGUIMIENTO">Seguimiento</option>
                          <option value="CERRADO">Cerrado</option>
                          <option value="ARCHIVADO">Archivado</option>
                        </optgroup>
                        <optgroup label="Legacy">
                          <option value="BORRADOR">Borrador</option><option value="PRESENTADA">Presentada</option><option value="BAJA">Baja</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ ...btn, background: '#22c55e' }} onClick={async () => {
                  setEditMsg('');
                  try {
                    if (clientEdit.id) await fetch('/api/clients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clientEdit.id, name: clientEdit.name, email: clientEdit.email, phone: clientEdit.phone, address: clientEdit.address }) });
                    await fetch(`/api/cases/${encodeURIComponent(editing.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: editing.priority, status: editing.status, counterparty: editing.counterparty, counterpartyAddress: editing.counterpartyAddress, intent: editing.intent }) });
                    setEditMsg('✓ Guardado correctamente');
                    setTimeout(() => { setEditing(null); refreshList(); }, 1200);
                  } catch { setEditMsg('Error al guardar'); }
                }}>
                  Guardar cambios
                </button>
                <button style={{ ...btn, background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b' }} onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  try {
    const auth = getAuthFromCookies(req.headers.cookie);
    if (!auth || auth.role !== 'ABOGADO') return { redirect: { destination: '/login', permanent: false } };
    const cases = await prisma.legalCase.findMany({
      where: { isActive: true, abogadoId: auth.uid },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        client: true,
        deadlines: { where: { status: 'PENDIENTE' }, orderBy: { dueDate: 'asc' }, take: 3, select: { id: true, title: true, dueDate: true, status: true } }
      },
    });
    let caMap: Record<string, string | null> = {};
    try {
      const ids = cases.map(c => c.id);
      if (ids.length > 0) {
        const caRows = await prisma.$queryRawUnsafe<Array<{ id: string; counterpartyAddress: string | null }>>(
          `SELECT "id","counterpartyAddress" FROM "LegalCase" WHERE "id" = ANY($1::text[])`, ids
        );
        for (const row of caRows) caMap[row.id] = row.counterpartyAddress || null;
      }
    } catch {}
    const rows: Row[] = cases.map(c => {
      const nextDeadline = (c.deadlines?.[0] as any) || null;
      return {
        id: c.id,
        expediente: c.expediente,
        clientId: c.client?.id || null,
        clientName: c.client?.name || '—',
        clientEmail: c.client?.email || null,
        clientPhone: c.client?.phone || null,
        clientAddress: c.client?.address || null,
        counterparty: c.counterparty,
        counterpartyAddress: caMap[c.id] || null,
        intent: c.intent || null,
        priority: c.priority,
        status: c.status,
        createdAt: new Date(c.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
        matter: (c as any).matter || 'CIVIL',
        ciudad: (c as any).ciudad || null,
        courtNumber: (c as any).courtNumber || null,
        courtType: (c as any).courtType || null,
        expedienteReal: (c as any).expedienteReal || null,
        estadoAsignacion: (c as any).estadoAsignacion || null,
        abogadoId: c.abogadoId || null,
        proximoVencimiento: nextDeadline ? {
          id: String(nextDeadline.id),
          title: String(nextDeadline.title),
          status: String(nextDeadline.status),
          dueDate: nextDeadline.dueDate ? new Date(nextDeadline.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
        } : null,
      };
    });
    return { props: { rows, userEmail: auth.email || '', userName: auth.name || '' } };
  } catch (e: any) {
    console.error('expedientes SSR error:', e?.message || e);
    return { props: { rows: [], userEmail: '', userName: '' } };
  }
};
