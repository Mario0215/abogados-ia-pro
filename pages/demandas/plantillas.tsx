import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { getAuthFromCookies } from '../../lib/auth';

type Tpl = { id: string; title: string; matter: string; submatter?: string | null; scope: 'SISTEMA' | 'PERSONAL' };

export default function PlantillasCentro() {
  const [scope, setScope] = useState<'SISTEMA' | 'PERSONAL' | 'TODAS'>('TODAS');
  const [tipo, setTipo] = useState<string>('');
  const [all, setAll] = useState<Tpl[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [matter, setMatter] = useState('CIVIL');
  const [submatter, setSubmatter] = useState('');
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams();
    if (tipo) qs.set('tipo', tipo);
    const r = await fetch(`/api/templates?${qs.toString()}`);
    const d = await r.json().catch(() => ({}));
    const list: Tpl[] = (d.templates || []).map((t: any) => ({
      id: String(t.id),
      title: String(t.title),
      matter: String(t.matter || 'CIVIL'),
      submatter: t.submatter || null,
      scope: (t.scope || 'SISTEMA').toUpperCase() === 'PERSONAL' ? 'PERSONAL' : 'SISTEMA'
    }));
    setAll(list);
  }, [tipo]);
  useEffect(() => { void refresh(); }, [refresh]);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    all.forEach(t => { if (t.submatter) s.add(String(t.submatter)); });
    return Array.from(s).sort();
  }, [all]);

  const sistema = all.filter(t => t.scope === 'SISTEMA' && (!tipo || t.submatter === tipo));
  const propias = all.filter(t => t.scope === 'PERSONAL' && (!tipo || t.submatter === tipo));
  const mostradas = useMemo(() => {
    if (scope === 'SISTEMA') return sistema;
    if (scope === 'PERSONAL') return propias;
    return [...propias, ...sistema];
  }, [scope, sistema, propias]);

  async function onSave() {
    setMsg('');
    if (!title || !content) { setMsg('Título y contenido son requeridos'); return; }
    const body: any = { title, content, matter, submatter: submatter || null };
    if (editing) body.id = editing.id;
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setTitle(''); setContent(''); setSubmatter(''); setEditing(null);
      setMsg(editing ? 'Plantilla actualizada' : 'Plantilla creada');
      refresh();
    } else {
      setMsg(d.error || 'Error');
    }
  }

  async function onDelete(id: string) {
    const ok = typeof window !== 'undefined' ? window.confirm('¿Eliminar plantilla?') : true;
    if (!ok) return;
    const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) { setMsg('Plantilla eliminada'); refresh(); } else { setMsg('Sin permisos o error'); }
  }

  return (
    <>
      <Head><title>Demandas – Plantillas</title></Head>
      <div className="container">
        <header className="header">
          <div className="brand">Cymnova IA</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/demandas" className="button">En Proceso</Link>
            <Link href="/dashboard" className="button">Volver</Link>
          </div>
        </header>
        <div className="card">
          <h2 className="title">Plantillas</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select className="select" value={scope} onChange={e => setScope(e.target.value as any)}>
              <option value="TODAS">Todas</option>
              <option value="SISTEMA">Sistema</option>
              <option value="PERSONAL">Mis Plantillas</option>
            </select>
            <select className="select" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Tipo de Demanda…</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="button" onClick={() => { setEditing(null); setTitle(''); setContent(''); setMatter('CIVIL'); setSubmatter(''); }}>Añadir Propia</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>Plantillas del Sistema</div>
              <ul>
                {sistema.map(t => (
                  <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #e5e7eb' }}>
                    <span>{t.title} {t.submatter ? <span className="badge gray" style={{ marginLeft: 6 }}>{t.submatter}</span> : null}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <Link href={`/api/templates?id=${encodeURIComponent(t.id)}`} className="button button-sm">Ver</Link>
                      <button className="button button-sm" title="Crear una copia en Mis Plantillas" onClick={async () => {
                        setMsg('');
                        try {
                          const r = await fetch(`/api/templates?id=${encodeURIComponent(t.id)}`);
                          const d = await r.json().catch(() => ({}));
                          if (r.ok && d?.template?.content) {
                            const body = {
                              title: String(t.title) + ' (copia)',
                              content: String(d.template.content),
                              matter: String(t.matter || 'CIVIL'),
                              submatter: t.submatter || null
                            };
                            const rr = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                            if (rr.ok) {
                              setMsg('Copiada a Mis Plantillas');
                              refresh();
                            } else {
                              const dd = await rr.json().catch(() => ({}));
                              setMsg(dd.error || 'No se pudo copiar');
                            }
                          } else {
                            setMsg('No se pudo leer la plantilla');
                          }
                        } catch {
                          setMsg('Error de red');
                        }
                      }}>Guardar como propia</button>
                    </span>
                  </li>
                ))}
                {sistema.length === 0 && <li className="muted">No hay plantillas del sistema</li>}
              </ul>
            </div>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>Mis Plantillas</div>
              <ul>
                {propias.map(t => (
                  <li key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e5e7eb' }}>
                    <span>{t.title} {t.submatter ? <span className="badge gray" style={{ marginLeft: 6 }}>{t.submatter}</span> : null}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="button button-sm" onClick={async () => {
                        const r = await fetch(`/api/templates?id=${encodeURIComponent(t.id)}`);
                        const d = await r.json().catch(() => ({}));
                        setEditing(t);
                        setTitle(t.title);
                        setMatter(t.matter);
                        setSubmatter(t.submatter || '');
                        setContent(String(d?.template?.content || ''));
                      }}>Editar</button>
                      <button className="button button-sm" onClick={() => onDelete(t.id)}>Eliminar</button>
                    </div>
                  </li>
                ))}
                {propias.length === 0 && <li className="muted">No hay plantillas propias</li>}
              </ul>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3 className="title">{editing ? 'Editar Plantilla' : 'Crear Plantilla Nueva'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input" placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
            <select className="select" value={matter} onChange={e => setMatter(e.target.value)}>
              {['CIVIL'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="input" placeholder="Tipo de Demanda" value={submatter} onChange={e => setSubmatter(e.target.value)} />
            <textarea className="input" rows={10} placeholder="Pega aquí tu formato" value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="button" onClick={onSave}>{editing ? 'Actualizar' : 'Crear'}</button>
            {msg && <span className="muted">{msg}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
};
