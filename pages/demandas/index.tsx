import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';
import AppLayout from '../../components/AppLayout';

type Row = {
  id: string;
  cliente: string;
  expediente: string;
  ultimaEdicion: string;
  avance: 'REAL' | 'PROV' | '—';
};

type Props = { items: Row[]; userEmail: string };

export default function DemandasCentro({ items, userEmail }: Props) {
  return (
    <AppLayout userName={userEmail}>
      <Head><title>Demandas – Abogados IA</title></Head>
      <style jsx>{`
        .draft-row:hover td { background: rgba(201,168,76,0.04); }
      `}</style>

      {/* ── Hero (Itaca pattern) ── */}
      <div style={{ padding: '56px 40px 48px', textAlign: 'center', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>Generación de Demandas</h1>
        <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 40px' }}>La IA redacta tu demanda completa con artículos del CC y CPC</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 860, margin: '0 auto 40px' }}>
          {[
            { icon: '📝', title: 'Cuestionario inteligente', desc: 'Preguntas específicas por tipo: divorcio, alimentos, arrendamiento, usucapión y más' },
            { icon: '🧠', title: 'IA con artículos reales', desc: 'Genera Hechos, Derecho y Prestaciones con artículos del CC/CPC por sección' },
            { icon: '✏️', title: 'Editor profesional', desc: 'Revisa, ajusta con IA y exporta a DOCX en un clic, listo para presentar' },
          ].map(item => (
            <div key={item.title} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '28px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 16 }}>
          <Link href="/mis-casos" style={{
            background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 999,
            padding: '13px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
            display: 'inline-block',
          }}>
            + Nueva Demanda
          </Link>
          {items.length > 0 && (
            <a href="#borradores" style={{
              background: 'transparent', color: '#c9a84c', border: '2px solid rgba(201,168,76,0.4)',
              borderRadius: 999, padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
              display: 'inline-block',
            }}>
              Ver {items.length} borrador{items.length !== 1 ? 'es' : ''} en proceso
            </a>
          )}
        </div>

        <div style={{ maxWidth: 440, margin: '32px auto 0' }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ background: '#0d1117', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(201,168,76,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#0d1117' }}>▶</div>
            </div>
            <div style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8', textAlign: 'left' }}>⚖️ Cómo generar una demanda con IA en Abogados IA, paso a paso</div>
          </div>
        </div>
      </div>

      {/* ── Borradores en proceso ── */}
      {items.length > 0 && (
        <div id="borradores" style={{ padding: '36px 40px' }}>
          <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
            Borradores en proceso
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0d1117' }}>
                  {['Cliente', 'Expediente', 'Última edición', 'Avance', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id} className="draft-row" style={{ borderTop: i > 0 ? '1px solid #1e293b' : 'none', transition: 'background 0.1s' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#e2e8f0' }}>{it.cliente}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#c9a84c', fontWeight: 600 }}>{it.expediente}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{it.ultimaEdicion}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {it.avance === 'REAL'
                        ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>Número Real</span>
                        : it.avance === 'PROV'
                        ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>Folio PROV</span>
                        : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(100,116,139,0.12)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' }}>Sin folio</span>
                      }
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <Link href={`/demandas/${it.id}/editor`} style={{
                        background: '#c9a84c', color: '#0d1117', borderRadius: 999,
                        padding: '7px 16px', fontSize: 12, textDecoration: 'none', fontWeight: 700,
                      }}>
                        Continuar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const cases = await prisma.legalCase.findMany({
    where: { isActive: true, NOT: { status: { in: ['PRESENTADA', 'BAJA'] as any } }, OR: [{ abogadoId: auth.uid }, { userId: auth.uid }] },
    select: { id: true, expediente: true, client: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  const items: Row[] = [];
  for (const c of cases) {
    const att = await prisma.caseAttachment.findFirst({
      where: { caseId: c.id, mimeType: 'text/plain' },
      orderBy: { createdAt: 'desc' },
    });
    if (!att) continue;
    let avance: 'REAL' | 'PROV' | '—' = '—';
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ expedienteReal: string | null; folioProvisional: string | null }>>(
        `SELECT "expedienteReal","folioProvisional" FROM "LegalCase" WHERE "id" = $1`, c.id
      );
      const er = rows?.[0]?.expedienteReal?.trim();
      const fp = rows?.[0]?.folioProvisional?.trim();
      if (er) avance = 'REAL';
      else if (fp) avance = 'PROV';
    } catch {}
    items.push({
      id: c.id,
      cliente: c.client?.name || '—',
      expediente: c.expediente,
      ultimaEdicion: new Date(att.createdAt).toLocaleString('es-MX'),
      avance,
    });
  }
  return { props: { items, userEmail: auth.email || '' } };
};
