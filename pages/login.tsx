import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.role === 'ADMIN') router.push('/admin');
        else router.push('/dashboard');
      } else {
        setError(data.error || 'Error de autenticación');
      }
    } catch {
      setError('Error de red. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Iniciar Sesión – Abogados IA</title></Head>
      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; font-family: 'Georgia', serif; color: #e2e8f0; }
        input:focus { outline: none; border-color: #c9a84c !important; }
        input:focus-visible, a:focus-visible, button:focus-visible { outline: 3px solid #f1f5f9; outline-offset: 3px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#0d1117',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px'
      }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>
            Bienvenido a
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#c9a84c', letterSpacing: 2 }}>
            Abogados IA
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            CYMNOVA A.C. · Plataforma Legal Inteligente
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#111827', borderRadius: 16,
          border: '1px solid #1e293b', padding: '40px 36px',
          width: '100%', maxWidth: 440,
          animation: 'fadeIn 0.5s ease 0.1s both'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
            Iniciar Sesión
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28 }}>
            Ingresa tus credenciales para acceder al sistema
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="login-email" style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                style={{
                  width: '100%', background: '#0d1117',
                  border: '1px solid #1e293b', borderRadius: 8,
                  padding: '12px 16px', color: '#e2e8f0', fontSize: 14,
                  transition: 'border-color 0.15s'
                }}
              />
            </div>

            <div>
              <label htmlFor="login-password" style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{
                  width: '100%', background: '#0d1117',
                  border: '1px solid #1e293b', borderRadius: 8,
                  padding: '12px 16px', color: '#e2e8f0', fontSize: 14,
                  transition: 'border-color 0.15s'
                }}
              />
            </div>

            {error && (
              <div role="alert" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%', background: '#c9a84c', border: 'none',
                borderRadius: 8, padding: '13px', color: '#0d1117',
                fontSize: 15, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                opacity: loading || !email || !password ? 0.6 : 1,
                transition: 'opacity 0.15s', marginTop: 4
              }}
            >
              {loading ? '⏳ Entrando...' : 'Entrar →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link href="/forgot" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Volver al inicio</Link>
          <span style={{ margin: '0 12px' }}>·</span>
          <span>Cymnova A.C. · Todos los Derechos Reservados</span>
        </div>

      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
