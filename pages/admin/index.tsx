import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { getAuthFromCookies } from '../../lib/auth';
import { useEffect, useState } from 'react';
import Logo from '../../components/Logo';

type UserItem = { id: string; name: string; email: string; active: boolean; role: string };
type StateItem = { id: string; name: string; active: boolean };
type DocItem = { id: string; title: string; matter: string; jurisdiccion: string; active: boolean; state?: { name: string } | null; content?: string };
type MatterItem = { key: string; label: string; active: boolean };

export default function Admin() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'ABOGADO'>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [orderBy, setOrderBy] = useState<'createdAt' | 'name' | 'email'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userMsg, setUserMsg] = useState('');
  const [states, setStates] = useState<StateItem[]>([]);
  const [newState, setNewState] = useState('');
  const [message, setMessage] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docMatter, setDocMatter] = useState('CIVIL');
  const [docJur, setDocJur] = useState('FEDERAL');
  const [docStateId, setDocStateId] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const matters = ['CIVIL','PENAL','MERCANTIL','LABORAL','FAMILIAR','ADMINISTRATIVA'];
  const jurs = ['FEDERAL','ESTATAL'];
  const [isFormat, setIsFormat] = useState(false);
  const [matterItems, setMatterItems] = useState<MatterItem[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [pasteSubmatter, setPasteSubmatter] = useState('Procesal/Adjetivo');
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<'menu' | 'update' | 'delete'>('menu');
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  useEffect(() => {
    async function loadInitialData() {
      const [s, d, m] = await Promise.all([
        fetch('/api/catalog/states').then(r => r.json()),
        fetch('/api/admin/documents').then(r => r.json()),
        fetch('/api/admin/matters').then(r => r.json())
      ]);
      setStates(s.states || []);
      setDocs(d.documents || []);
      setMatterItems(m.matters || []);

      setLoadingUsers(true);
      setUserMsg('');
      const res = await fetch('/api/admin/users?orderBy=createdAt&sort=desc&skip=0&take=20');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setUsersTotal(Number(data.total || 0));
      } else {
        setUserMsg(data.error || 'Error obteniendo usuarios');
      }
      setLoadingUsers(false);
    }

    void loadInitialData();
  }, []);

  async function refresh() {
    const [s, d, m] = await Promise.all([
      fetch('/api/catalog/states').then(r => r.json()),
      fetch('/api/admin/documents').then(r => r.json()),
      fetch('/api/admin/matters').then(r => r.json())
    ]);
    setStates(s.states || []);
    setDocs(d.documents || []);
    setMatterItems(m.matters || []);
    fetchUsers();
  }

  async function fetchUsers() {
    setLoadingUsers(true);
    setUserMsg('');
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (activeFilter === 'ACTIVE') params.set('active', 'true');
    if (activeFilter === 'INACTIVE') params.set('active', 'false');
    params.set('orderBy', orderBy);
    params.set('sort', sortDir);
    params.set('skip', String(skip));
    params.set('take', String(take));
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users || []);
      setUsersTotal(Number(data.total || 0));
    } else {
      setUserMsg(data.error || 'Error obteniendo usuarios');
    }
    setLoadingUsers(false);
  }

  async function toggleUser(id: string, active: boolean) {
    setUserMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      fetchUsers();
    } else {
      setUserMsg(data.error || 'No fue posible actualizar el usuario');
    }
  }

  async function changeRole(id: string, role: 'ADMIN' | 'ABOGADO') {
    setUserMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      fetchUsers();
    } else {
      setUserMsg(data.error || 'No fue posible cambiar el rol');
    }
  }

  async function addState() {
    if (!newState.trim()) return;
    const res = await fetch('/api/catalog/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newState })
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Estado agregado');
      setNewState('');
      refresh();
    } else {
      setMessage(data.error || 'Error agregando estado');
    }
  }

  async function uploadDoc() {
    if (!docTitle || !docMatter || (!docJur && !isFormat)) return;
    const form = new FormData();
    form.append('title', docTitle);
    form.append('matter', docMatter);
    form.append('jurisdiccion', isFormat ? 'FORMATO' : docJur);
    if (!isFormat && docStateId) form.append('stateId', docStateId);
    form.append('active', 'true');
    if (docFile) form.append('file', docFile);
    const res = await fetch('/api/admin/documents', { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) {
      setMessage('Documento cargado');
      setDocTitle('');
      setDocStateId('');
      setDocFile(null);
      refresh();
    } else {
      setMessage(data.error || 'Error cargando documento');
    }
  }

  async function toggleDoc(id: string, active: boolean) {
    const res = await fetch('/api/admin/documents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active })
    });
    if (res.ok) refresh();
  }

  async function toggleMatter(key: string, active: boolean) {
    const res = await fetch('/api/admin/matters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, active })
    });
    if (res.ok) refresh();
  }

  async function importPasted() {
    if (!pastedText.trim()) {
      setMessage('Pega el contenido a importar');
      return;
    }
    const res = await fetch('/api/admin/import-pasted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: pastedText,
        matter: 'CIVIL',
        submatter: pasteSubmatter,
        jurisdiccion: 'ESTATAL'
      })
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Importación completada: ${data.upserts} elementos. Total: ${data.total}`);
      setPastedText('');
      refresh();
    } else {
      setMessage(data.error || 'Error importando texto pegado');
    }
  }

  function openEdit(id: string) {
    const d = docs.find(x => x.id === id);
    setEditDocId(id);
    setEditText(d?.content || '');
    setEditMode('menu');
    setEditOpen(true);
  }
  function startUpdate() {
    setEditMode('update');
  }
  function startDelete() {
    setEditMode('delete');
  }
  function saveUpdateLocal() {
    if (!editDocId) return;
    setDocs(ds => ds.map(d => d.id === editDocId ? { ...d, content: editText } : d));
    setEditOpen(false);
    setEditMode('menu');
    setEditDocId(null);
    setEditText('');
  }
  function confirmDeleteLocal() {
    if (!editDocId) return;
    setDocs(ds => ds.filter(d => d.id !== editDocId));
    setEditOpen(false);
    setEditMode('menu');
    setEditDocId(null);
    setEditText('');
  }
  function cancelEdit() {
    setEditOpen(false);
    setEditMode('menu');
    setEditDocId(null);
    setEditText('');
  }

  return (
    <>
      <Head><title>Panel de Administración</title></Head>
      <div className="container">
        <header className="header">
          <Logo />
          <Link href="/api/auth/logout" className="button">Salir</Link>
        </header>
        <div className="card">
          <h2 className="title">Gestión de Usuarios</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <input className="input" placeholder="Buscar por nombre o correo" value={q} onChange={e => { setQ(e.target.value); setSkip(0); }} style={{ flex: 1 }} />
            <select className="select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value as any); setSkip(0); }}>
              <option value="ALL">Todos</option>
              <option value="ADMIN">ADMIN</option>
              <option value="ABOGADO">ABOGADO</option>
            </select>
            <select className="select" value={activeFilter} onChange={e => { setActiveFilter(e.target.value as any); setSkip(0); }}>
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
            <select className="select" value={orderBy} onChange={e => setOrderBy(e.target.value as any)}>
              <option value="createdAt">Creado</option>
              <option value="name">Nombre</option>
              <option value="email">Correo</option>
            </select>
            <select className="select" value={sortDir} onChange={e => setSortDir(e.target.value as any)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <button className="button" onClick={() => { setSkip(0); fetchUsers(); }}>Buscar</button>
          </div>
          {userMsg && <p className="muted">{userMsg}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="muted" style={{ textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Nombre</th>
                  <th style={{ padding: '6px' }}>Correo</th>
                  <th style={{ padding: '6px' }}>Rol</th>
                  <th style={{ padding: '6px' }}>Estado</th>
                  <th style={{ padding: '6px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td className="muted" colSpan={5} style={{ padding: '8px' }}>Cargando…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td className="muted" colSpan={5} style={{ padding: '8px' }}>Sin resultados</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '6px' }}>{u.name}</td>
                      <td style={{ padding: '6px' }}>{u.email}</td>
                      <td style={{ padding: '6px' }}>
                        <select className="select" value={u.role} onChange={e => changeRole(u.id, e.target.value as 'ADMIN' | 'ABOGADO')}>
                          <option value="ADMIN">ADMIN</option>
                          <option value="ABOGADO">ABOGADO</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px' }}>
                        <span className="muted" style={{ color: u.active ? '#065f46' : '#7f1d1d', fontWeight: 600 }}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '6px' }}>
                        <button className="button" onClick={() => toggleUser(u.id, !u.active)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <div className="muted">Total: {usersTotal}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="button" disabled={skip === 0} onClick={() => { const next = Math.max(skip - take, 0); setSkip(next); fetchUsers(); }}>Anterior</button>
              <button className="button" disabled={skip + take >= usersTotal} onClick={() => { const next = skip + take; setSkip(next); fetchUsers(); }}>Siguiente</button>
              <select className="select" value={take} onChange={e => { setTake(Number(e.target.value)); setSkip(0); fetchUsers(); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Catálogo de Estados</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input" placeholder="Nuevo estado" value={newState} onChange={e => setNewState(e.target.value)} />
            <button className="button" onClick={addState}>Agregar</button>
          </div>
          {message && <p className="muted">{message}</p>}
          <ul>
            {states.map(s => (
              <li key={s.id} className="muted">{s.name} {s.active ? '' : '(inactivo)'}</li>
            ))}
          </ul>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="title">Gestión de Leyes y Documentos</h2>
            <Link href="/admin/tag-documents" style={{ fontSize: 13, background: '#3b82f6', color: 'white', borderRadius: 6, padding: '6px 14px', textDecoration: 'none', fontWeight: 600 }}>
              Clasificar con IA
            </Link>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
            <input className="input" placeholder="Título del documento" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
            <select className="select" value={docMatter} onChange={e => setDocMatter(e.target.value)}>
              {matters.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="checkbox" checked={isFormat} onChange={e => setIsFormat(e.target.checked)} />
                Formato de Demanda
              </label>
              {!isFormat && (
                <select className="select" value={docJur} onChange={e => setDocJur(e.target.value)}>
                  {jurs.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {!isFormat && (
              <select className="select" value={docStateId} onChange={e => setDocStateId(e.target.value)} style={{ maxWidth: 260 }}>
                <option value="">Sin Estado</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <label className="button" style={{ cursor: 'pointer' }}>
              Seleccionar archivo
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setDocFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </label>
            <button className="button" onClick={uploadDoc}>Cargar</button>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h3 className="title">Importación por pegado (Código de Procedimientos Civiles GTO)</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <textarea
                className="input"
                placeholder="Pega aquí el texto completo. Se segmentará por Artículos y el contenido preliminar se guardará como “Preliminar”."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                rows={10}
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="muted">Submateria:</span>
                <input
                  className="input"
                  value={pasteSubmatter}
                  onChange={e => setPasteSubmatter(e.target.value)}
                  style={{ maxWidth: 240 }}
                />
                <button className="button" onClick={importPasted}>Importar por pegado</button>
              </div>
              <p className="muted">Materia: CIVIL · Jurisdicción: ESTATAL · Estado: Guanajuato</p>
            </div>
          </div>
          <h3 className="title" style={{ marginTop: '1rem' }}>Documentos</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="muted" style={{ textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Título</th>
                  <th style={{ padding: 8 }}>Materia</th>
                  <th style={{ padding: 8 }}>Jurisdicción</th>
                  <th style={{ padding: 8 }}>Estado</th>
                  <th style={{ padding: 8 }}>Activo</th>
                  <th style={{ padding: 8 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr><td className="muted" colSpan={6} style={{ padding: 8 }}>Sin documentos</td></tr>
                ) : (
                  docs.map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{d.title}</td>
                      <td style={{ padding: 8 }}>{d.matter}</td>
                      <td style={{ padding: 8 }}>{d.jurisdiccion}</td>
                      <td style={{ padding: 8 }}>{d.state?.name || '—'}</td>
                      <td style={{ padding: 8 }}>
                        <span className="muted" style={{ color: d.active ? '#065f46' : '#7f1d1d', fontWeight: 600 }}>
                          {d.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: 8, display: 'flex', gap: '0.5rem' }}>
                        <button className="button" onClick={() => toggleDoc(d.id, !d.active)}>{d.active ? 'Desactivar' : 'Activar'}</button>
                        <button className="button" onClick={() => openEdit(d.id)}>Editar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {editOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div className="card" style={{ width: 'min(640px, 96vw)' }}>
              {editMode === 'menu' && (
                <div>
                  <div className="title">Acciones</div>
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: 8 }}>
                    <button className="button" onClick={startUpdate}>Actualizar ley</button>
                    <button className="button" style={{ background: '#7f1d1d' }} onClick={startDelete}>Eliminar ley</button>
                    <button className="button" onClick={cancelEdit}>Cancelar</button>
                  </div>
                </div>
              )}
              {editMode === 'update' && (
                <div>
                  <div className="title">Actualizar ley</div>
                  <textarea className="input" rows={10} value={editText} onChange={e => setEditText(e.target.value)} placeholder="Pega o reemplaza el texto completo de la ley…" />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="button" onClick={saveUpdateLocal}>Guardar cambios</button>
                    <button className="button" onClick={cancelEdit}>Cancelar</button>
                  </div>
                </div>
              )}
              {editMode === 'delete' && (
                <div>
                  <div className="title">Eliminar ley</div>
                  <p className="muted">¿Confirmas eliminar esta ley? Esta acción en esta vista solo afecta la tabla local.</p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="button" style={{ background: '#7f1d1d' }} onClick={confirmDeleteLocal}>Eliminar</button>
                    <button className="button" onClick={cancelEdit}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Materias activas para Consulta Legal</h2>
          <ul>
            {matterItems.map(mi => (
              <li key={mi.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="muted">{mi.label}</span>
                <button className="button" onClick={() => toggleMatter(mi.key, !mi.active)}>{mi.active ? 'Desactivar' : 'Activar'}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Jurisprudencias</h2>
          <p className="muted">Gestión de criterios y tesis. Próxima conexión a la API; esta sección sirve como acceso rápido y resumen.</p>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { redirect: { destination: '/admin/panel-demo', permanent: false } };
};
