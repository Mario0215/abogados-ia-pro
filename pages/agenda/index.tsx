import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';
import { computeDeadlineStatus, computeDeadlineAlert } from '../../lib/deadline';
import type { ComputedDeadlineStatus, DeadlineAlert } from '../../lib/deadline';
import AppLayout from '../../components/AppLayout';

type DeadlineRow = { id: string; caseId: string; expediente: string; clientName: string; title: string; startDate: string; dueDate: string; termDays: number; status: string };
type Props = { rows: DeadlineRow[]; userName: string };

const ALERT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  red:   { bg: 'rgba(192,57,43,0.08)',  color: '#c0392b', border: '1px solid rgba(192,57,43,0.25)' },
  amber: { bg: 'rgba(180,83,9,0.08)',  color: '#b45309', border: '1px solid rgba(180,83,9,0.25)' },
  blue:  { bg: 'rgba(26,109,194,0.08)', color: '#1a6dc2', border: '1px solid rgba(26,109,194,0.25)' },
  green: { bg: 'rgba(34,160,107,0.08)', color: '#22a06b', border: '1px solid rgba(34,160,107,0.25)' },
  gray:  { bg: '#f5f5f5',               color: '#9b9b9b', border: '1px solid #e5e5e5' },
  muted: { bg: '#f5f5f5',               color: '#9b9b9b', border: '1px solid #e5e5e5' },
};

function chipAlert(alert: DeadlineAlert, computed: ComputedDeadlineStatus) {
  if (alert.label) {
    const s = ALERT_STYLES[alert.variant] || ALERT_STYLES.muted;
    return { label: alert.label, style: { background: s.bg, color: s.color, border: s.border, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 } };
  }
  if (computed === 'PENDIENTE') {
    const s = ALERT_STYLES.blue;
    return { label: 'Pendiente', style: { background: s.bg, color: s.color, border: s.border, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 } };
  }
  if (computed === 'CUMPLIDO') {
    const s = ALERT_STYLES.green;
    return { label: 'Cumplido', style: { background: s.bg, color: s.color, border: s.border, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 } };
  }
  if (computed === 'CANCELADO') {
    const s = ALERT_STYLES.gray;
    return { label: 'Cancelado', style: { background: s.bg, color: s.color, border: s.border, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 } };
  }
  const s = ALERT_STYLES.muted;
  return { label: computed, style: { background: s.bg, color: s.color, border: s.border, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 } };
}

export default function Agenda({ rows, userName }: Props) {
  const rowsComputed = rows.map(r => ({
    ...r,
    computedStatus: computeDeadlineStatus(r.dueDate, r.status) as ComputedDeadlineStatus,
    alert: computeDeadlineAlert(r.dueDate, r.status),
  }));
  const [localRows, setLocalRows] = useState(rowsComputed);
  const [filtro, setFiltro] = useState<string>('TODOS');
  const [buscar, setBuscar] = useState('');

  async function marcarCumplido(id: string) {
    try {
      const r = await fetch('/api/deadlines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'CUMPLIDO' })
      });
      if (!r.ok) return;
      setLocalRows(prev => prev.map(row => (row.id === id ? { ...row, status: 'CUMPLIDO', computedStatus: 'CUMPLIDO', alert: { label: 'Cumplido', variant: 'green', daysDiff: 0 } } : row)));
    } catch {}
  }

  const filtrados = localRows.filter(r => {
    const matchStatus = filtro === 'TODOS' || r.computedStatus === filtro;
    const q = buscar.toLowerCase().trim();
    const matchBuscar = !q || r.title.toLowerCase().includes(q) || r.expediente.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
    return matchStatus && matchBuscar;
  });

  const conteo = {
    TODOS: localRows.length,
    PENDIENTE: localRows.filter(r => r.computedStatus === 'PENDIENTE').length,
    VENCIDO: localRows.filter(r => r.computedStatus === 'VENCIDO').length,
    CUMPLIDO: localRows.filter(r => r.computedStatus === 'CUMPLIDO').length,
    CANCELADO: localRows.filter(r => r.computedStatus === 'CANCELADO').length,
  };

  return (
    <AppLayout userName={userName}>
      <Head><title>Agenda y Plazos – Abogados IA</title></Head>
      <style jsx>{`
        tr:hover td { background: #f9f9f9; }
      `}</style>

        <div style={{ padding: '36px 40px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#3d3d3d' }}>Agenda y Plazos</div>
            <div style={{ fontSize: 13, color: '#6b6b6b', marginTop: 4 }}>Plazos procesales y vencimientos de tus expedientes asignados</div>
          </div>

          {/* Tarjetas de estado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
            {(['TODOS', 'PENDIENTE', 'VENCIDO', 'CUMPLIDO', 'CANCELADO'] as const).map(s => {
              const accent = s === 'VENCIDO' ? '#c0392b' : undefined;
              return (
              <div key={s} onClick={() => setFiltro(s)} style={{
                background: filtro === s ? '#efefef' : '#ffffff',
                border: `1px solid ${filtro === s ? (accent || '#9b9b9b') : '#e5e5e5'}`,
                borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: accent || '#3d3d3d' }}>{conteo[s]}</div>
                <div style={{ fontSize: 11, color: accent || '#9b9b9b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s}</div>
              </div>
            ); })}
          </div>

          {/* Buscador */}
          <div style={{ marginBottom: 16 }}>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por título, expediente o cliente..."
              style={{
                background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8,
                padding: '10px 14px', color: '#3d3d3d', fontSize: 13, width: 360,
                transition: 'border-color 0.15s'
              }}
            />
          </div>

          {/* Tabla */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Título', 'Notificación', 'Días', 'Vence', 'Expediente', 'Alerta', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9b9b9b', fontSize: 14 }}>
                    {rows.length === 0 ? 'Sin plazos registrados.' : 'Sin resultados para el filtro seleccionado.'}
                  </td></tr>
                ) : filtrados.map((r, i) => {
                  const chip = chipAlert(r.alert, r.computedStatus);
                  const rowBg = r.computedStatus === 'VENCIDO' ? 'rgba(192,57,43,0.04)' : r.alert.variant === 'amber' ? 'rgba(180,83,9,0.04)' : undefined;
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                        transition: 'background 0.1s',
                        background: rowBg,
                      }}
                    >
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#3d3d3d' }}>{r.title}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b6b6b' }}>{new Date(r.startDate).toLocaleDateString('es-MX')}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b6b6b' }}>{r.termDays}d</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: r.computedStatus === 'VENCIDO' ? '#dc2626' : '#6b6b6b', fontWeight: r.computedStatus === 'VENCIDO' ? 700 : 400 }}>
                      {new Date(r.dueDate).toLocaleDateString('es-MX')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, color: '#3d3d3d' }}>{r.clientName}</div>
                        <div style={{ fontSize: 11, color: '#6b6b6b' }}>{r.expediente}</div>
                        <div>
                          <Link href={`/mis-casos/${encodeURIComponent(r.caseId)}`} style={{ fontSize: 12, color: '#4b4b4b', textDecoration: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                            Ver caso →
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={chip.style}>{chip.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.computedStatus === 'PENDIENTE' || r.computedStatus === 'VENCIDO' ? (
                        <button
                          onClick={() => marcarCumplido(r.id)}
                          style={{ background: 'transparent', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6b6b6b', cursor: 'pointer' }}
                        >
                          Cumplido
                        </button>
                      ) : null}
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  try {
    const auth = getAuthFromCookies(req.headers.cookie);
    if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    const where: any = auth.role === 'ADMIN'
      ? {}
      : { case: { is: { abogadoId: auth.uid } } };
    const items = await prisma.caseDeadline.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: 200,
      include: {
        case: {
          select: { expediente: true, client: { select: { name: true } } }
        }
      }
    });
    const rows: DeadlineRow[] = items.map(d => ({
      id: d.id,
      caseId: d.caseId,
      expediente: d.case?.expediente || '',
      clientName: d.case?.client?.name || '',
      title: d.title,
      startDate: new Date(d.startDate).toISOString(),
      dueDate: new Date(d.dueDate).toISOString(),
      termDays: d.termDays,
      status: d.status as string
    }));
    return { props: { rows, userName: auth.email || '' } };
  } catch {
    return { props: { rows: [], userName: '' } };
  }
};
