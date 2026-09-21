import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getAuthFromCookies } from '../../../lib/auth';
import { OfficialPdfUpload } from '../../../components/legal/OfficialPdfUpload';

type Source = { id: string; authority: string; url: string; trustLevel: string; status: string; capturedAt: string; contentHash?: string | null; targetNorm?: { canonicalId: string; matter: string } | null; originalFileName?: string | null; originalSizeBytes?: number | null; originalSha256?: string | null; extractionStatus?: string; extractionError?: string | null };
type Norm = { id: string; canonicalId: string; officialName: string; matter: string; scope: string; active: boolean; matters: Array<{ matter: string }>; _count?: { versions: number } };
type Version = { id: string; versionKey: string; status: string; contentHash?: string | null; norm: { canonicalId: string; officialName: string }; source?: { id: string; authority: string; status: string; targetNormId?: string | null; originalFileName?: string | null; extractionStatus?: string } | null; _count?: { provisions: number } };
type Rule = { id: string; ruleKey: string; name: string; matter: string; territory: string; result: string; regime?: string | null; active: boolean; priority: number };

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #334155', borderRadius: 8, background: '#0d1117', color: '#e2e8f0', fontSize: 14 };
const actionStyle = { border: '1px solid #334155', borderRadius: 8, padding: '9px 13px', cursor: 'pointer', color: '#e2e8f0', background: '#1e293b', fontSize: 13 };

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

export default function LegalGovernanceAdmin() {
  const [sources, setSources] = useState<Source[]>([]);
  const [norms, setNorms] = useState<Norm[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceForm, setSourceForm] = useState({ authority: '', url: '', trustLevel: 'PRIMARY_OFFICIAL', originFile: '', contentHash: '' });
  const [normForm, setNormForm] = useState({ canonicalId: '', officialName: '', matter: 'CIVIL', scope: 'STATE', issuingAuthority: '', shared: false });
  const [versionForm, setVersionForm] = useState({ normId: '', sourceId: '', versionKey: '', publicationDate: '', effectiveFrom: '', effectiveTo: '', notes: '' });
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<{ count: number; warnings: string[] } | null>(null);
  const [ruleForm, setRuleForm] = useState({ kind: 'APPLICABILITY', ruleKey: '', name: '', matter: 'CIVIL', territory: 'GUANAJUATO', result: 'RESOLVED', regime: 'CPC_GTO_LEGACY', sourceId: '', priority: '10', ruleVersion: '1.0.0', explanation: '', effectiveFrom: '', effectiveTo: '' });

  const activeSources = useMemo(() => sources.filter((source) => source.status === 'ACTIVE'), [sources]);

  async function refresh() {
    const [sourceData, normData, versionData, ruleData] = await Promise.all([
      api('/api/admin/legal/sources'),
      api('/api/admin/legal/norms'),
      api('/api/admin/legal/versions'),
      api('/api/admin/legal/rules')
    ]);
    setSources(sourceData.sources || []);
    setNorms(normData.norms || []);
    setVersions(versionData.versions || []);
    setRules([...(ruleData.applicabilityRules || []), ...(ruleData.transitionRules || [])]);
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error.message)); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  function jsonBody(body: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api('/api/admin/legal/sources', jsonBody(sourceForm));
      setSourceForm({ authority: '', url: '', trustLevel: 'PRIMARY_OFFICIAL', originFile: '', contentHash: '' });
      setMessage('Fuente registrada como DRAFT. Verifica su origen antes de activarla.');
    });
  }

  async function submitNorm(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const matters = normForm.shared && ['CIVIL', 'FAMILIAR'].includes(normForm.matter) ? ['CIVIL', 'FAMILIAR'] : [normForm.matter];
      await api('/api/admin/legal/norms', jsonBody({ ...normForm, matters }));
      setNormForm({ canonicalId: '', officialName: '', matter: 'CIVIL', scope: 'STATE', issuingAuthority: '', shared: false });
      setMessage('Norma registrada sin texto ni versión.');
    });
  }

  async function submitVersion(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const response = await api('/api/admin/legal/versions', jsonBody({ action: 'draft', ...versionForm }));
      setSelectedVersionId(response.version.id);
      setMessage(response.created ? 'Versión creada en DRAFT.' : 'Reimportación idempotente: se reutilizó la versión existente.');
    });
  }

  async function makePreview() {
    await run(async () => {
      const response = await api('/api/admin/legal/versions', jsonBody({ action: 'preview', rawText }));
      setPreview({ count: response.preview.provisions.length, warnings: response.preview.warnings || [] });
      setMessage('Estructura previsualizada; no se guardó ningún texto.');
    });
  }

  async function importStructure() {
    await run(async () => {
      if (!selectedVersionId) throw new Error('Selecciona una versión DRAFT antes de importar estructura.');
      await api('/api/admin/legal/versions', jsonBody({ action: 'importStructure', versionId: selectedVersionId, rawText }));
      setMessage('Estructura guardada en la versión DRAFT; aún no está publicada ni indexada.');
    });
  }

  async function submitRule(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api('/api/admin/legal/rules', jsonBody({
        ...ruleForm,
        priority: Number(ruleForm.priority),
        active: false
      }));
      setMessage('Regla creada inactiva. Actívala sólo después de verificar fuente, fechas y alcance.');
    });
  }

  return (
    <>
      <Head><title>Gobierno normativo · Abogados IA Pro</title></Head>
      <main style={{ minHeight: '100vh', background: '#0d1117', color: '#e2e8f0', padding: '32px clamp(18px, 4vw, 56px)', fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <Link href="/admin/panel-demo" style={{ color: '#c9a84c', fontSize: 13, textDecoration: 'none' }}>← Panel ADMIN</Link>
              <h1 style={{ margin: '10px 0 6px', fontSize: 30 }}>Gobierno normativo</h1>
              <p style={{ margin: 0, color: '#94a3b8', maxWidth: 760, lineHeight: 1.6 }}>Catálogo y trazabilidad para Civil, Familiar y Laboral en Guanajuato. Los PDFs oficiales se conservan y estructuran como borradores; las transiciones nunca se deciden automáticamente.</p>
            </div>
            <button disabled={busy} onClick={() => void run(async () => { await api('/api/admin/legal/norms', jsonBody({ action: 'seedInitialCatalog' })); setMessage('Catálogo oficial inicial sincronizado sin textos normativos.'); })} style={{ ...actionStyle, background: '#7b632c', borderColor: '#c9a84c' }}>Sincronizar catálogo inicial</button>
          </div>
          {message && <div role="status" style={{ marginBottom: 20, padding: '12px 14px', border: '1px solid #a9822a', borderRadius: 8, color: '#f3d88e', background: 'rgba(201,168,76,.1)' }}>{message}</div>}

          <div style={{ marginBottom: 18 }}>
            <OfficialPdfUpload onUploaded={() => void refresh()} onDraftCreated={() => void refresh()} />
          </div>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
            <form onSubmit={(event) => void submitSource(event)} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <h2 style={{ marginTop: 0, fontSize: 19 }}>1. Fuente verificable</h2>
              <p style={{ color: '#94a3b8', fontSize: 13, minHeight: 38 }}>Registra origen, hash y confianza. Toda fuente nace en DRAFT.</p>
              <div style={{ display: 'grid', gap: 9 }}>
                <input required aria-label="Autoridad" placeholder="Autoridad emisora" value={sourceForm.authority} onChange={(event) => setSourceForm({ ...sourceForm, authority: event.target.value })} style={inputStyle} />
                <input required type="url" aria-label="URL oficial" placeholder="https://…" value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} style={inputStyle} />
                <select aria-label="Nivel de confianza" value={sourceForm.trustLevel} onChange={(event) => setSourceForm({ ...sourceForm, trustLevel: event.target.value })} style={inputStyle}>
                  <option>PRIMARY_OFFICIAL</option><option>OFFICIAL_CONSOLIDATED</option><option>OFFICIAL_OPERATIONAL</option><option>CURATED_INTERNAL</option>
                </select>
                <input aria-label="Archivo u origen" placeholder="Archivo/origen (opcional)" value={sourceForm.originFile} onChange={(event) => setSourceForm({ ...sourceForm, originFile: event.target.value })} style={inputStyle} />
                <input aria-label="Hash de contenido" placeholder="Hash de contenido (opcional)" value={sourceForm.contentHash} onChange={(event) => setSourceForm({ ...sourceForm, contentHash: event.target.value })} style={inputStyle} />
                <button disabled={busy} style={{ ...actionStyle, background: '#234c72' }}>Registrar fuente</button>
              </div>
            </form>

            <form onSubmit={(event) => void submitNorm(event)} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <h2 style={{ marginTop: 0, fontSize: 19 }}>2. Norma canónica</h2>
              <p style={{ color: '#94a3b8', fontSize: 13, minHeight: 38 }}>Alta de metadatos. Sólo materias habilitadas y sin textos precargados.</p>
              <div style={{ display: 'grid', gap: 9 }}>
                <input required aria-label="Identificador canónico" placeholder="Ej. LEY_EJEMPLO_GTO" value={normForm.canonicalId} onChange={(event) => setNormForm({ ...normForm, canonicalId: event.target.value })} style={inputStyle} />
                <input required aria-label="Nombre oficial" placeholder="Nombre oficial" value={normForm.officialName} onChange={(event) => setNormForm({ ...normForm, officialName: event.target.value })} style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <select value={normForm.matter} onChange={(event) => setNormForm({ ...normForm, matter: event.target.value })} style={inputStyle}><option>CIVIL</option><option>FAMILIAR</option><option>LABORAL</option></select>
                  <select value={normForm.scope} onChange={(event) => setNormForm({ ...normForm, scope: event.target.value })} style={inputStyle}><option>STATE</option><option>FEDERAL</option><option>NATIONAL</option></select>
                </div>
                <input required aria-label="Autoridad emisora" placeholder="Autoridad emisora" value={normForm.issuingAuthority} onChange={(event) => setNormForm({ ...normForm, issuingAuthority: event.target.value })} style={inputStyle} />
                <label style={{ color: '#cbd5e1', fontSize: 13 }}><input type="checkbox" checked={normForm.shared} disabled={!['CIVIL', 'FAMILIAR'].includes(normForm.matter)} onChange={(event) => setNormForm({ ...normForm, shared: event.target.checked })} /> Aplicable a Civil y Familiar</label>
                <button disabled={busy} style={{ ...actionStyle, background: '#234c72' }}>Registrar norma</button>
              </div>
            </form>
          </section>

          <section style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}><h2 style={{ margin: 0, fontSize: 18 }}>Fuentes registradas</h2></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ color: '#64748b', textAlign: 'left' }}><th style={{ padding: '11px 16px' }}>Autoridad</th><th>Norma / original</th><th>Confianza</th><th>Estado</th><th>Hash</th><th>Acción</th></tr></thead>
                <tbody>{sources.map((source) => <tr key={source.id} style={{ borderTop: '1px solid #1e293b' }}><td style={{ padding: '11px 16px' }}><a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#cbd5e1' }}>{source.authority}</a></td><td>{source.targetNorm ? <><strong>{source.targetNorm.canonicalId}</strong><div style={{ color: '#94a3b8', marginTop: 3 }}>{source.originalFileName || 'Sin archivo'} · {source.extractionStatus || 'NOT_REQUESTED'}</div>{source.originalFileName && <a href={`/api/admin/legal/sources/${source.id}/original`} target="_blank" rel="noreferrer" style={{ color: '#c9a84c', fontSize: 12 }}>Descargar original</a>}</> : 'Fuente manual'}</td><td>{source.trustLevel}</td><td>{source.status}</td><td style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{source.originalSha256 ? `${source.originalSha256.slice(0, 12)}…` : source.contentHash ? `${source.contentHash.slice(0, 12)}…` : 'Sin hash'}</td><td><button disabled={busy || source.status === 'ACTIVE'} onClick={() => void run(async () => { await api('/api/admin/legal/sources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: source.id, status: 'ACTIVE' }) }); setMessage('Fuente activada tras verificación administrativa.'); })} style={actionStyle}>Activar tras verificar</button></td></tr>)}</tbody>
              </table>
            </div>
            {!sources.length && <p style={{ padding: '16px 20px', color: '#94a3b8' }}>No hay fuentes registradas.</p>}
          </section>

          <section style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 19 }}>3. Versión, estructura e indexación</h2>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>La publicación exige fuente activa oficial y hash. Previsualizar no persiste; importar estructura sólo modifica DRAFT/UNDER_REVIEW.</p>
            <form onSubmit={(event) => void submitVersion(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 9, alignItems: 'end' }}>
              <select required value={versionForm.normId} onChange={(event) => setVersionForm({ ...versionForm, normId: event.target.value })} style={inputStyle}><option value="">Norma…</option>{norms.map((norm) => <option key={norm.id} value={norm.id}>{norm.canonicalId}</option>)}</select>
              <select value={versionForm.sourceId} onChange={(event) => setVersionForm({ ...versionForm, sourceId: event.target.value })} style={inputStyle}><option value="">Fuente (opcional en borrador)…</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.status} · {source.authority}</option>)}</select>
              <input required placeholder="Clave de versión" value={versionForm.versionKey} onChange={(event) => setVersionForm({ ...versionForm, versionKey: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Publicación" value={versionForm.publicationDate} onChange={(event) => setVersionForm({ ...versionForm, publicationDate: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Vigencia desde" value={versionForm.effectiveFrom} onChange={(event) => setVersionForm({ ...versionForm, effectiveFrom: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Vigencia hasta" value={versionForm.effectiveTo} onChange={(event) => setVersionForm({ ...versionForm, effectiveTo: event.target.value })} style={inputStyle} />
              <button disabled={busy} style={{ ...actionStyle, background: '#234c72' }}>Crear/reimportar DRAFT</button>
            </form>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(250px, .55fr)', gap: 14, marginTop: 16 }}>
              <textarea aria-label="Texto para estructura" value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Pega texto sólo después de verificar fuente oficial. Se detectarán Libro/Título/Capítulo/Artículo…" rows={10} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ display: 'grid', alignContent: 'start', gap: 9 }}>
                <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} style={inputStyle}><option value="">Versión DRAFT/UNDER_REVIEW…</option>{versions.filter((version) => ['DRAFT', 'UNDER_REVIEW'].includes(version.status)).map((version) => <option key={version.id} value={version.id}>{version.norm.canonicalId} · {version.versionKey}</option>)}</select>
                <button disabled={busy || !rawText.trim()} onClick={() => void makePreview()} type="button" style={actionStyle}>Previsualizar estructura</button>
                <button disabled={busy || !rawText.trim() || !selectedVersionId} onClick={() => void importStructure()} type="button" style={{ ...actionStyle, background: '#234c72' }}>Guardar estructura DRAFT</button>
                {preview && <div style={{ color: '#cbd5e1', fontSize: 13 }}>Disposiciones: {preview.count}{preview.warnings.map((warning) => <div key={warning} style={{ color: '#f3d88e', marginTop: 5 }}>• {warning}</div>)}</div>}
              </div>
            </div>
          </section>

          <section style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 19 }}>4. Reglas de aplicabilidad y transición</h2>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Las reglas se crean inactivas y no dependen del LLM. Para activarlas por API se exige una fuente oficial activa.</p>
            <form onSubmit={(event) => void submitRule(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
              <select value={ruleForm.kind} onChange={(event) => setRuleForm({ ...ruleForm, kind: event.target.value })} style={inputStyle}><option value="APPLICABILITY">Aplicabilidad</option><option value="TRANSITION">Transición</option></select>
              <input required placeholder="Clave de regla" value={ruleForm.ruleKey} onChange={(event) => setRuleForm({ ...ruleForm, ruleKey: event.target.value.toUpperCase() })} style={inputStyle} />
              <input required placeholder="Nombre" value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} style={inputStyle} />
              <select value={ruleForm.matter} onChange={(event) => setRuleForm({ ...ruleForm, matter: event.target.value })} style={inputStyle}><option>CIVIL</option><option>FAMILIAR</option><option>LABORAL</option></select>
              <select value={ruleForm.territory} onChange={(event) => setRuleForm({ ...ruleForm, territory: event.target.value })} style={inputStyle}><option>GUANAJUATO</option><option>FEDERAL_NACIONAL</option></select>
              <select value={ruleForm.regime} onChange={(event) => setRuleForm({ ...ruleForm, regime: event.target.value })} style={inputStyle}><option>CPC_GTO_LEGACY</option><option>CNPCF</option><option>LABORAL_FEDERAL</option></select>
              <select value={ruleForm.sourceId} onChange={(event) => setRuleForm({ ...ruleForm, sourceId: event.target.value })} style={inputStyle}><option value="">Fuente (para activar después)…</option>{activeSources.map((source) => <option key={source.id} value={source.id}>{source.authority}</option>)}</select>
              <input placeholder="Prioridad" type="number" value={ruleForm.priority} onChange={(event) => setRuleForm({ ...ruleForm, priority: event.target.value })} style={inputStyle} />
              <input placeholder="Versión de regla" value={ruleForm.ruleVersion} onChange={(event) => setRuleForm({ ...ruleForm, ruleVersion: event.target.value })} style={inputStyle} />
              <input required placeholder="Explicación y condición verificable" value={ruleForm.explanation} onChange={(event) => setRuleForm({ ...ruleForm, explanation: event.target.value })} style={inputStyle} />
              <button disabled={busy} style={{ ...actionStyle, background: '#234c72' }}>Crear regla inactiva</button>
            </form>
          </section>

          <section style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 19 }}>Estado del catálogo</h2><button onClick={() => void run(async () => { await refresh(); setMessage('Catálogo actualizado.'); })} disabled={busy} style={actionStyle}>Actualizar</button></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 13 }}>
                <thead><tr style={{ color: '#64748b', textAlign: 'left' }}><th style={{ padding: '12px 16px' }}>Norma</th><th>Materias</th><th>Versiones</th><th>Última versión</th><th>Acciones</th></tr></thead>
                <tbody>{norms.map((norm) => {
                  const version = versions.find((item) => item.norm.canonicalId === norm.canonicalId);
                  return <tr key={norm.id} style={{ borderTop: '1px solid #1e293b' }}><td style={{ padding: '12px 16px' }}><strong>{norm.canonicalId}</strong><div style={{ color: '#94a3b8', marginTop: 3 }}>{norm.officialName}</div></td><td>{norm.matters.map((item) => item.matter).join(' · ')}</td><td>{norm._count?.versions ?? 0}</td><td>{version ? `${version.versionKey} · ${version.status}` : 'Sin versión'}</td><td><div style={{ display: 'flex', gap: 6 }}>
                    {version && version.status === 'DRAFT' && <button disabled={busy || !version.contentHash || !version.source || (version._count?.provisions ?? 0) === 0} onClick={() => void run(async () => { await api('/api/admin/legal/versions', jsonBody({ action: 'startReview', versionId: version.id })); setMessage('Versión enviada a revisión administrativa.'); })} style={actionStyle}>Pasar a revisión</button>}
                    {version && version.status === 'UNDER_REVIEW' && <button disabled={busy || !version.contentHash || !version.source || version.source.status !== 'ACTIVE'} onClick={() => void run(async () => { await api('/api/admin/legal/versions', jsonBody({ action: 'publish', versionId: version.id })); setMessage('Versión publicada según sus fechas de vigencia.'); })} style={actionStyle}>Publicar</button>}
                    {version && ['PUBLISHED', 'CURRENT', 'FUTURE'].includes(version.status) && <button disabled={busy} onClick={() => void run(async () => { await api('/api/admin/legal/versions', jsonBody({ action: 'reindex', versionId: version.id })); setMessage('Reindexación encolada; no se invocó IA desde ADMIN.'); })} style={actionStyle}>Encolar RAG</button>}
                    {version && !['REPEALED', 'HISTORICAL'].includes(version.status) && <button disabled={busy} onClick={() => { const reason = window.prompt('Motivo de retiro no destructivo:'); if (reason) void run(async () => { await api('/api/admin/legal/versions', jsonBody({ action: 'retire', versionId: version.id, reason })); setMessage('Versión retirada sin borrar su historial.'); }); }} style={{ ...actionStyle, color: '#fecaca' }}>Retirar</button>}
                  </div></td></tr>;
                })}</tbody>
              </table>
            </div>
            {!norms.length && <p style={{ padding: 20, color: '#94a3b8' }}>Aún no hay normas. Sincroniza el catálogo inicial para crear sólo sus metadatos.</p>}
          </section>

          <section style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
            <strong style={{ color: '#cbd5e1' }}>Reglas registradas:</strong> {rules.length}. Las decisiones de régimen y la búsqueda controlada se exponen por APIs separadas; no están conectadas a la generación de demandas en esta fase.
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
};
