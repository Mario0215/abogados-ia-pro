import { FormEvent, useEffect, useState } from 'react';

type Norm = {
  id: string;
  canonicalId: string;
  officialName: string;
  matter: string;
  active: boolean;
};

type PreviewProvision = {
  type: string;
  designation: string;
  heading: string | null;
  structurePath: string;
};

type SourceResult = {
  id: string;
  status: string;
  extractionStatus: string;
  originalFileName?: string | null;
  originalSizeBytes?: number | null;
  originalSha256?: string | null;
  extractionError?: string | null;
};

type UploadResult = {
  source: SourceResult;
  norm?: { id: string; canonicalId: string; matter: string };
  preview?: {
    count: number;
    articleCount: number;
    warnings: string[];
    provisions: PreviewProvision[];
  };
  message?: string;
  deduplicated?: boolean;
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #334155',
  borderRadius: 8,
  background: '#0d1117',
  color: '#e2e8f0',
  fontSize: 14,
  boxSizing: 'border-box' as const
};

const buttonStyle = {
  border: '1px solid #c9a84c',
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer',
  color: '#111827',
  background: '#c9a84c',
  fontWeight: 700,
  fontSize: 13
};

function dateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(value?: number | null) {
  if (!value) return '—';
  return `${(value / (1024 * 1024)).toFixed(value >= 1024 * 1024 ? 2 : 1)} MB`;
}

export function OfficialPdfUpload(props: { onDraftCreated?: () => void; onUploaded?: () => void }) {
  const [norms, setNorms] = useState<Norm[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    normId: '',
    authority: '',
    url: '',
    trustLevel: 'PRIMARY_OFFICIAL',
    capturedAt: dateInputValue(),
    notes: ''
  });
  const [version, setVersion] = useState({ versionKey: '', publicationDate: '', effectiveFrom: '', effectiveTo: '', notes: '' });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/admin/legal/norms');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar el catálogo jurídico.');
        setNorms((data.norms || []).filter((norm: Norm) => norm.active));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el catálogo jurídico.');
      }
    })();
  }, []);

  async function sendUpload(reprocess = false) {
    if (!file) {
      setError('Selecciona un PDF oficial antes de continuar.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append('reprocess', reprocess ? 'true' : 'false');
      const response = await fetch('/api/admin/legal/upload', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo conservar el PDF oficial.');
      setResult(data as UploadResult);
      setMessage(data.message || 'PDF conservado como fuente en borrador.');
      props.onUploaded?.();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo procesar el PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    await sendUpload(false);
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    if (!result?.source?.id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/legal/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draftFromSource', normId: form.normId, sourceId: result.source.id, ...version })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la versión en borrador.');
      setMessage(`Versión ${data.version.versionKey} creada en DRAFT con ${data.structure?.preview?.provisions?.length ?? 0} disposiciones. Aún no está en revisión, publicada ni indexada.`);
      props.onDraftCreated?.();
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'No se pudo crear el borrador.');
    } finally {
      setBusy(false);
    }
  }

  const canCreateDraft = result?.source.extractionStatus === 'EXTRACTED' && Boolean(result.preview?.articleCount);

  return (
    <section style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 12, padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: '#c9a84c', fontSize: 17 }}>Subir PDF oficial</h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>PDF original → texto derivado → previsualización → versión DRAFT. No se activa, publica ni indexa automáticamente.</p>
        </div>
        <span style={{ border: '1px solid #475569', borderRadius: 99, color: '#cbd5e1', padding: '5px 9px', fontSize: 11 }}>Límite: 25 MB · sólo PDF</span>
      </div>

      {error && <div role="alert" style={{ background: 'rgba(239,68,68,.12)', border: '1px solid #b91c1c', color: '#fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {message && <div role="status" style={{ background: 'rgba(34,197,94,.1)', border: '1px solid #15803d', color: '#bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{message}</div>}

      <form onSubmit={(event) => void upload(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <select required aria-label="Norma del PDF" value={form.normId} onChange={(event) => setForm({ ...form, normId: event.target.value })} style={inputStyle}>
          <option value="">Norma jurídica…</option>
          {norms.map((norm) => <option key={norm.id} value={norm.id}>{norm.canonicalId} · {norm.matter}</option>)}
        </select>
        <input required aria-label="Autoridad emisora" placeholder="Autoridad emisora" value={form.authority} onChange={(event) => setForm({ ...form, authority: event.target.value })} style={inputStyle} />
        <input required type="url" aria-label="URL oficial" placeholder="https:// URL oficial" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} style={inputStyle} />
        <select aria-label="Nivel de confianza" value={form.trustLevel} onChange={(event) => setForm({ ...form, trustLevel: event.target.value })} style={inputStyle}>
          <option value="PRIMARY_OFFICIAL">PRIMARY_OFFICIAL</option>
          <option value="OFFICIAL_CONSOLIDATED">OFFICIAL_CONSOLIDATED</option>
          <option value="OFFICIAL_OPERATIONAL">OFFICIAL_OPERATIONAL</option>
        </select>
        <label style={{ color: '#94a3b8', fontSize: 12, display: 'grid', gap: 5 }}>Fecha de consulta
          <input required type="date" value={form.capturedAt} onChange={(event) => setForm({ ...form, capturedAt: event.target.value })} style={inputStyle} />
        </label>
        <label style={{ color: '#94a3b8', fontSize: 12, display: 'grid', gap: 5 }}>Archivo PDF oficial
          <input required type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }} style={{ ...inputStyle, padding: 7 }} />
        </label>
        <input aria-label="Notas de verificación" placeholder="Notas de verificación (opcional)" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={inputStyle} />
        <button disabled={busy || !file} style={{ ...buttonStyle, opacity: busy || !file ? .6 : 1 }}>
          {busy ? 'Procesando…' : 'Subir y previsualizar'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 18, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#cbd5e1', fontSize: 13 }}>
            <span><strong>Fuente:</strong> {result.source.status} · {result.source.extractionStatus}</span>
            <span><strong>Original:</strong> {result.source.originalFileName || file?.name || 'PDF'} · {formatBytes(result.source.originalSizeBytes)}</span>
            <a href={`/api/admin/legal/sources/${result.source.id}/original`} target="_blank" rel="noreferrer" style={{ color: '#c9a84c' }}>Descargar original</a>
          </div>
          {result.source.originalSha256 && <div style={{ marginTop: 6, color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>SHA-256: {result.source.originalSha256}</div>}
          {result.preview && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, .55fr)', gap: 14 }}>
              <div style={{ border: '1px solid #334155', borderRadius: 8, maxHeight: 260, overflow: 'auto' }}>
                {result.preview.provisions.map((provision) => <div key={provision.structurePath} style={{ borderBottom: '1px solid #1e293b', padding: '8px 10px', fontSize: 12 }}>
                  <span style={{ color: '#c9a84c', marginRight: 8 }}>{provision.type}</span>
                  <strong style={{ color: '#e2e8f0' }}>{provision.designation}</strong>{provision.heading ? <span style={{ color: '#94a3b8' }}> — {provision.heading}</span> : null}
                </div>)}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                <div><strong>{result.preview.articleCount}</strong> artículos detectados</div>
                <div><strong>{result.preview.count}</strong> disposiciones detectadas</div>
                {result.preview.warnings.slice(0, 4).map((warning) => <div key={warning} style={{ color: '#f3d88e', marginTop: 7 }}>• {warning}</div>)}
                {result.preview.warnings.length > 4 && <div style={{ color: '#f3d88e', marginTop: 7 }}>• {result.preview.warnings.length - 4} advertencias adicionales quedaron registradas para revisión.</div>}
              </div>
            </div>
          )}
          {result.deduplicated && result.source.extractionStatus === 'EXTRACTED' && (
            <button type="button" disabled={busy || !file} onClick={() => void sendUpload(true)} style={{ ...buttonStyle, marginTop: 14, background: '#1e293b', color: '#f3d88e', borderColor: '#64748b', opacity: busy || !file ? .6 : 1 }}>
              {busy ? 'Reprocesando…' : 'Reprocesar la fuente conservada'}
            </button>
          )}
          {!canCreateDraft && <p style={{ color: '#f3d88e', fontSize: 13, margin: '14px 0 0' }}>{result.source.extractionError || 'No se puede crear el borrador hasta que el texto extraído tenga artículos revisables.'}</p>}
          {canCreateDraft && (
            <form onSubmit={(event) => void createDraft(event)} style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
              <input required placeholder="Clave de versión, ej. 2026-01-15" value={version.versionKey} onChange={(event) => setVersion({ ...version, versionKey: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Fecha de publicación" value={version.publicationDate} onChange={(event) => setVersion({ ...version, publicationDate: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Vigencia desde" value={version.effectiveFrom} onChange={(event) => setVersion({ ...version, effectiveFrom: event.target.value })} style={inputStyle} />
              <input type="date" aria-label="Vigencia hasta" value={version.effectiveTo} onChange={(event) => setVersion({ ...version, effectiveTo: event.target.value })} style={inputStyle} />
              <button disabled={busy} style={{ ...buttonStyle, opacity: busy ? .6 : 1 }}>{busy ? 'Guardando…' : 'Crear versión DRAFT'}</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
