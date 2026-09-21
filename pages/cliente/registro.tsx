import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { PORTAL_CONFIG } from '../../lib/cliente-config';
import { getClienteFromCookies } from '../../lib/cliente-auth';

const G = '#896419';

export default function ClienteRegistro() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/cliente/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        router.push('/cliente/cuestionario');
      } else {
        setError(data.error || 'Error al crear la cuenta');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  const inputSt: React.CSSProperties = { width: '100%', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#3d3d3d', fontFamily: 'Georgia, serif', outline: 'none' };
  const labelSt: React.CSSProperties = { fontSize: 12, color: '#6b6b6b', display: 'block', marginBottom: 6 };

  return (
    <>
      <Head><title>Crear cuenta — Portal del Cliente</title></Head>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #faf9f7; font-family: Georgia, serif; }`}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e5', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/cliente" style={{ fontSize: 15, fontWeight: 700, color: '#3d3d3d', textDecoration: 'none' }}>{PORTAL_CONFIG.nombreDespacho}</Link>
          <Link href="/cliente/login" style={{ fontSize: 13, color: '#6b6b6b', textDecoration: 'none' }}>Ya tengo cuenta</Link>
        </header>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 16, padding: '40px 44px', width: '100%', maxWidth: 460 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: G, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Portal del cliente</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#3d3d3d' }}>Crear cuenta</h1>
              <p style={{ fontSize: 13, color: '#9b9b9b', marginTop: 8 }}>
                Si ya eres cliente del despacho, tu expediente se vincula automáticamente.
              </p>
            </div>

            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus style={inputSt} placeholder="Juan Pérez García" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputSt} placeholder="tu@correo.com" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Teléfono (opcional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputSt} placeholder="477 000 0000" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputSt} placeholder="Mínimo 6 caracteres" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelSt}>Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputSt} placeholder="Repite tu contraseña" />
              </div>

              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c53030', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#d4b97a' : G, border: 'none', borderRadius: 8, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Georgia, serif' }}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#9b9b9b' }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/cliente/login" style={{ color: G, textDecoration: 'none', fontWeight: 600 }}>Inicia sesión</Link>
            </div>
          </div>
        </div>

        <footer style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#c5c5c5' }}>
          {PORTAL_CONFIG.nombreDespacho} · {PORTAL_CONFIG.contacto.email}
        </footer>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (auth) return { redirect: { destination: '/cliente/dashboard', permanent: false } };
  return { props: {} };
};
