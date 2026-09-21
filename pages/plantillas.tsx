import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useEffect, useState } from 'react';
import { getAuthFromCookies } from '../lib/auth';
import AppLayout from '../components/AppLayout';

type Item = { id: string; title: string; matter: string };

export default function Plantillas({ userEmail }: { userEmail: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [loading, setLoading] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    const r = await fetch('/api/templates');
    const d = await r.json().catch(() => ({}));
    setItems((d.templates || []).map((t: any) => ({
      id: String(t.id),
      title: String(t.title),
      matter: String(t.matter || 'CIVIL')
    })));
  }

  useEffect(() => { refresh(); }, []);

  function onEdit(it: Item) {
    setEditingId(it.id);
    setTitle(it.title);
    setShowForm(true);
    setMsg('');
    fetch(`/api/templates?id=${encodeURIComponent(it.id)}`)
      .then(r => r.json())
      .then(d => setContent(String(d?.template?.content || '')))
      .catch(() => setContent(''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onNueva() {
    setEditingId('');
    setTitle('');
    setContent('');
    setMsg('');
    setShowForm(true);
  }

  function onCancelar() {
    setEditingId('');
    setTitle('');
    setContent('');
    setMsg('');
    setShowForm(false);
  }

  async function onSave() {
    setMsg('');
    if (!title || !content) {
      setMsg('Título y contenido son requeridos');
      setMsgType('err');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId || undefined, title, content, matter: 'CIVIL' })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setEditingId('');
      setTitle('');
      setContent('');
      setShowForm(false);
      refresh();
      setMsg('Plantilla guardada correctamente');
      setMsgType('ok');
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg(data.error || 'No se pudo guardar');
      setMsgType('err');
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.status === 204) {
      setConfirmDelete(null);
      refresh();
      setMsg('Plantilla eliminada');
      setMsgType('ok');
      setTimeout(() => setMsg(''), 3000);
    }
  }

  const filtradas = items.filter(i => i.title.toLowerCase().includes(buscar.toLowerCase()));

  const inputStyle = {
    width: '100%', background: '#ffffff', border: '1px solid #e0e0e0',
    borderRadius: 8, padding: '11px 14px', color: '#3d3d3d', fontSize: 13,
  };

  return (
    <AppLayout userName={userEmail}>
      <Head><title>Plantillas – Abogados IA</title></Head>
      <style jsx>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        tr:hover td { background: #f9f9f9; }
      `}</style>

      <div style={{ padding: '36px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#3d3d3d' }}>Biblioteca de Plantillas</div>
            <div style={{ fontSize: 13, color: '#6b6b6b', marginTop: 4 }}>Formatos y modelos de demandas para reutilizar</div>
          </div>
          <button onClick={onNueva} style={{
            background: '#4b4b4b', border: 'none', borderRadius: 8,
            padding: '10px 18px', color: '#ffffff', fontSize: 13,
            fontWeight: 700, cursor: 'pointer'
          }}>
            + Nueva Plantilla
          </button>
        </div>

        {/* Mensaje global */}
        {msg && !showForm && (
          <div style={{
            background: msgType === 'ok' ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
            border: `1px solid ${msgType === 'ok' ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
            color: msgType === 'ok' ? '#16a34a' : '#dc2626',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 20,
            animation: 'fadeIn 0.3s ease'
          }}>
            {msg}
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div style={{
            background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12,
            padding: '28px', marginBottom: 28, animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3d3d3d', marginBottom: 20 }}>
              {editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                  Título de la plantilla *
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej. Demanda Ordinaria Civil"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                  Contenido (HTML o texto) *
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Escribe o pega el contenido de la plantilla aquí..."
                  rows={14}
                  style={{
                    ...inputStyle, resize: 'vertical',
                    fontFamily: 'monospace', lineHeight: 1.6
                  }}
                />
              </div>

              {msg && showForm && (
                <div style={{
                  background: msgType === 'ok' ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                  border: `1px solid ${msgType === 'ok' ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
                  color: msgType === 'ok' ? '#16a34a' : '#dc2626',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13
                }}>
                  {msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onSave} disabled={loading} style={{
                  background: '#4b4b4b', border: 'none', borderRadius: 8,
                  padding: '11px 24px', color: '#ffffff', fontSize: 13,
                  fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={onCancelar} style={{
                  background: 'transparent', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: '11px 20px', color: '#6b6b6b',
                  fontSize: 13, cursor: 'pointer'
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3d3d3d' }}>
              Mis Plantillas <span style={{ color: '#9b9b9b', fontWeight: 400, fontSize: 12 }}>({filtradas.length})</span>
            </div>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar plantilla..."
              style={{
                background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 8,
                padding: '8px 12px', color: '#3d3d3d', fontSize: 12, width: 220
              }}
            />
          </div>

          {filtradas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9b9b9b', fontSize: 14 }}>
              {items.length === 0
                ? 'No tienes plantillas aún. Crea la primera con el botón de arriba.'
                : 'Sin resultados para esa búsqueda.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Título', 'Materia', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', fontSize: 11, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((it, i) => (
                  <tr key={it.id} style={{ borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#3d3d3d' }}>{it.title}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        background: '#f5f5f5', color: '#6b6b6b',
                        border: '1px solid #e0e0e0',
                        borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600
                      }}>
                        {it.matter}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onEdit(it)} style={{
                          background: 'transparent', border: '1px solid #e0e0e0',
                          borderRadius: 6, padding: '5px 14px', color: '#4b4b4b',
                          fontSize: 12, cursor: 'pointer'
                        }}>
                          Editar
                        </button>
                        <button onClick={() => setConfirmDelete(it.id)} style={{
                          background: 'transparent', border: '1px solid rgba(220,38,38,0.25)',
                          borderRadius: 6, padding: '5px 14px', color: '#dc2626',
                          fontSize: 12, cursor: 'pointer'
                        }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal confirmación eliminar */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 28, maxWidth: 360, width: '90%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3d3d3d', marginBottom: 12 }}>¿Eliminar plantilla?</div>
            <div style={{ fontSize: 13, color: '#6b6b6b', marginBottom: 24 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onDelete(confirmDelete)} style={{
                background: '#dc2626', border: 'none', borderRadius: 8,
                padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{
                background: 'transparent', border: '1px solid #e0e0e0',
                borderRadius: 8, padding: '10px 20px', color: '#6b6b6b', fontSize: 13, cursor: 'pointer'
              }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: { userEmail: auth.email || '' } };
};
