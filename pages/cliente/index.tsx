import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { PORTAL_CONFIG } from '../../lib/cliente-config';
import { getClienteFromCookies } from '../../lib/cliente-auth';

type Props = {
  servicios: typeof PORTAL_CONFIG.servicios;
  nombreDespacho: string;
  tagline: string;
  contacto: typeof PORTAL_CONFIG.contacto;
};

const G = '#896419';

export default function ClienteLanding({ servicios, nombreDespacho, tagline, contacto }: Props) {
  return (
    <>
      <Head>
        <title>Portal del Cliente — {nombreDespacho}</title>
        <meta name="description" content={tagline} />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf9f7; font-family: Georgia, serif; color: #3d3d3d; }
        a { text-decoration: none; }
      `}</style>

      {/* NAV */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e5', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3d3d3d', letterSpacing: 1 }}>{nombreDespacho}</span>
            <span style={{ fontSize: 11, color: '#9b9b9b', marginLeft: 10 }}>Portal del cliente</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/cliente/login" style={{ fontSize: 13, color: '#6b6b6b', padding: '8px 16px' }}>Iniciar sesión</Link>
            <Link href="/cliente/registro" style={{ background: G, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 20px', borderRadius: 8 }}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e5', padding: '80px 24px 72px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: G, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>Derecho civil · Guanajuato</div>
          <h1 style={{ fontSize: 38, fontWeight: 700, color: '#3d3d3d', lineHeight: 1.25, marginBottom: 20 }}>
            Tu proceso legal,<br />claro y al día
          </h1>
          <p style={{ fontSize: 16, color: '#6b6b6b', lineHeight: 1.7, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
            Accede al estado de tu expediente, consulta documentos y sigue el avance de tu caso desde cualquier lugar.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/cliente/registro" style={{ background: G, color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 28px', borderRadius: 8 }}>
              Crear cuenta gratuita
            </Link>
            <Link href="/cliente/login" style={{ background: '#f5f5f5', color: '#4b4b4b', fontSize: 14, padding: '12px 28px', borderRadius: 8, border: '1px solid #e5e5e5' }}>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section style={{ padding: '72px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: G, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Servicios</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#3d3d3d' }}>¿En qué podemos ayudarte?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {servicios.map(s => (
            <div key={s.id} style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '24px 28px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#3d3d3d', marginBottom: 8 }}>{s.nombre}</div>
              <p style={{ fontSize: 13, color: '#6b6b6b', lineHeight: 1.6, marginBottom: 16 }}>{s.descripcion}</p>
              <div style={{ fontSize: 18, fontWeight: 700, color: G }}>
                {s.desde ? 'Desde ' : ''}{s.moneda === 'MXN' ? '$' : ''}{s.precio.toLocaleString()}
                <span style={{ fontSize: 11, color: '#9b9b9b', fontWeight: 400, marginLeft: 4 }}>MXN</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PASOS */}
      <section style={{ background: '#ffffff', borderTop: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5', padding: '72px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: G, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Cómo funciona</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#3d3d3d' }}>Tres pasos sencillos</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { n: '01', titulo: 'Crea tu cuenta', texto: 'Regístrate con tu correo. Si ya eres cliente del despacho, tu expediente se vincula automáticamente.' },
              { n: '02', titulo: 'Consulta tu caso', texto: 'Ve el estado actualizado de tu expediente, documentos disponibles y próximas fechas importantes.' },
              { n: '03', titulo: 'Mantente informado', texto: 'Recibe actualizaciones sobre el avance de tu proceso sin necesidad de llamar al despacho.' },
            ].map(p => (
              <div key={p.n} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: G, opacity: 0.5, marginBottom: 12 }}>{p.n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#3d3d3d', marginBottom: 8 }}>{p.titulo}</div>
                <p style={{ fontSize: 13, color: '#6b6b6b', lineHeight: 1.6 }}>{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '72px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#3d3d3d', marginBottom: 12 }}>¿Listo para empezar?</h2>
          <p style={{ fontSize: 14, color: '#6b6b6b', marginBottom: 28 }}>Crea tu cuenta en menos de un minuto y accede al portal de tu expediente.</p>
          <Link href="/cliente/registro" style={{ background: G, color: '#fff', fontSize: 14, fontWeight: 600, padding: '13px 32px', borderRadius: 8 }}>
            Crear cuenta gratuita
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f7f7f8', borderTop: '1px solid #e5e5e5', padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 6 }}>{nombreDespacho} · {contacto.email} · {contacto.telefono}</div>
        <div style={{ fontSize: 12, color: '#c5c5c5' }}>{contacto.direccion}</div>
      </footer>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (auth) return { redirect: { destination: '/cliente/dashboard', permanent: false } };

  return {
    props: {
      servicios: PORTAL_CONFIG.servicios,
      nombreDespacho: PORTAL_CONFIG.nombreDespacho,
      tagline: PORTAL_CONFIG.tagline,
      contacto: PORTAL_CONFIG.contacto,
    },
  };
};
