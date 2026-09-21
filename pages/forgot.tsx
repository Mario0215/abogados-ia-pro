import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState('');
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    setInfo(data.message || 'Si el correo existe, se enviará un enlace.');
  }
  return (
    <>
      <Head><title>Recuperar Contraseña</title></Head>
      <div className="container">
        <header className="header">
          <div className="brand">Cymnova IA</div>
          <Link href="/" className="button">Home</Link>
        </header>
        <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
          <h2 className="title">Recuperación de contraseña</h2>
          <form onSubmit={onSubmit}>
            <input className="input" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="button" type="submit">Enviar</button>
          </form>
          {info && <p className="muted">{info}</p>}
        </div>
      </div>
    </>
  );
}
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
