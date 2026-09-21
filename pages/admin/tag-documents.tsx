import { useState, useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getAuthFromCookies } from '../../lib/auth';

interface Stats { total: number; tagged: number; }
interface TagResult { id: string; title: string; demandTags: string[]; legalSection: string[]; error?: string; }
interface RunResult { processed: number; errors: number; results: TagResult[]; message?: string; }

export default function TagDocumentsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(20);
  const [onlyUntagged, setOnlyUntagged] = useState(true);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  const loadStats = async () => {
    try {
      const r = await fetch('/api/admin/tag-documents');
      const d = await r.json();
      setStats(d);
    } catch {}
  };

  useEffect(() => { loadStats(); }, []);

  const run = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/admin/tag-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyUntagged, limit })
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Error'); return; }
      setResult(d);
      await loadStats();
    } catch (e: any) {
      setError(e?.message || 'Error de red');
    } finally {
      setRunning(false);
    }
  };

  const pct = stats ? Math.round((stats.tagged / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <>
      <Head><title>Clasificar Documentos | Admin</title></Head>
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <a href="/admin/documents" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
              ← Volver a Documentos
            </a>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>
              Clasificación de Documentos
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              Usa GPT-4o-mini para etiquetar cada artículo con tipos de demanda y secciones relevantes.
            </p>
          </div>

          {/* Stats card */}
          {stats && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>Progreso de clasificación</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{stats.tagged} / {stats.total} ({pct}%)</span>
              </div>
              <div style={{ background: '#0f172a', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 99, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>{stats.total}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Total documentos</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399' }}>{stats.tagged}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Clasificados</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{stats.total - stats.tagged}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Pendientes</div>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Configuración</h2>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyUntagged}
                  onChange={(e) => setOnlyUntagged(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14 }}>Solo documentos sin clasificar</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>Documentos por lote:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 14 }}
                >
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={run}
                disabled={running}
                style={{
                  background: running ? '#334155' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: running ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {running ? '⏳ Clasificando...' : '▶ Iniciar Clasificación'}
              </button>
              <span style={{ marginLeft: 12, fontSize: 12, color: '#64748b' }}>
                ~{Math.round(limit * 0.4)}s estimado (200ms por documento)
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 8, padding: 16, marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>
              Error: {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 16px', fontSize: 14 }}>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{result.processed}</span>
                  <span style={{ color: '#64748b', marginLeft: 6 }}>procesados</span>
                </div>
                {result.errors > 0 && (
                  <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 16px', fontSize: 14 }}>
                    <span style={{ color: '#f87171', fontWeight: 700 }}>{result.errors}</span>
                    <span style={{ color: '#64748b', marginLeft: 6 }}>errores</span>
                  </div>
                )}
                {result.message && <div style={{ fontSize: 14, color: '#94a3b8', padding: '8px 0' }}>{result.message}</div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {result.results.map((r) => (
                  <div key={r.id} style={{
                    background: r.error ? '#450a0a' : '#0f172a',
                    border: `1px solid ${r.error ? '#dc2626' : '#1e293b'}`,
                    borderRadius: 8,
                    padding: '10px 14px'
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: r.error ? '#fca5a5' : '#e2e8f0' }}>
                      {r.title}
                    </div>
                    {r.error ? (
                      <div style={{ fontSize: 12, color: '#f87171' }}>Error: {r.error}</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Demandas: </span>
                          {r.demandTags.length ? (
                            r.demandTags.map(t => (
                              <span key={t} style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>{t}</span>
                            ))
                          ) : <span style={{ color: '#475569' }}>ninguna</span>}
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Secciones: </span>
                          {r.legalSection.length ? (
                            r.legalSection.map(s => (
                              <span key={s} style={{ background: '#1a3a2a', color: '#34d399', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>{s}</span>
                            ))
                          ) : <span style={{ color: '#475569' }}>ninguna</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
  return { props: {} };
};
