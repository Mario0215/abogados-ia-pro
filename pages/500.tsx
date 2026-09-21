import Link from 'next/link';

export default function ServerError() {
  return (
    <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h2>Error interno del servidor</h2>
        <p>Intenta nuevamente en unos momentos.</p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '1rem' }}>Ir al inicio</Link>
      </div>
    </div>
  );
}
