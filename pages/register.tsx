import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

export default function Register() {
  return (
    <>
      <Head><title>Registro – Abogados IA</title></Head>
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', padding: 24 }}>
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '48px 44px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#c9a84c', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>Abogados IA · Cymnova A.C.</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>Registro por invitación</h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28 }}>
            El registro de abogados comisionistas autorizados por ADMIN es gestionado directamente por el equipo de Abogados IA.
            Si deseas integrarte como abogado comisionista, contáctanos.
          </p>
          <a
            href="mailto:contacto@cymnova.mx"
            style={{ display: 'block', background: '#c9a84c', color: '#0d1117', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}
          >
            contacto@cymnova.mx
          </a>
          <Link href="/login" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
