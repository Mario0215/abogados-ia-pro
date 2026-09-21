import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h2>Página no encontrada</h2>
        <p>La ruta solicitada no existe.</p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '1rem' }}>Ir al inicio</Link>
      </div>
    </div>
  );
}
