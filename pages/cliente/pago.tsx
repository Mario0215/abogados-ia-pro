import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { PORTAL_CONFIG } from '../../lib/cliente-config';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/cliente/dashboard` },
    });
    if (stripeError) {
      setError(stripeError.message || 'Error al procesar el pago');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 520, margin: '0 auto', padding: '34px 22px', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, color: '#3d3d3d' }}>Pagar anticipo</h2>
      <p style={{ fontSize: 13, color: '#6b6b6b', marginBottom: 22, lineHeight: 1.6 }}>
        Completa el pago para iniciar tu expediente. Al finalizar, regresarás automáticamente a tu dashboard.
      </p>
      <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16 }}>
        <PaymentElement />
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: '100%',
          marginTop: 20,
          padding: '13px',
          background: '#4b4b4b',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading ? 'Procesando...' : 'Confirmar pago'}
      </button>
    </form>
  );
}

export default function PagoPage() {
  const router = useRouter();
  const { clientSecret } = router.query;

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b6b6b' }}>Falta configurar Stripe.</div>;
  }

  if (!clientSecret || typeof clientSecret !== 'string') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b6b6b' }}>Cargando...</div>;
  }

  return (
    <>
      <Head><title>Pago — {PORTAL_CONFIG.nombreDespacho}</title></Head>
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
        <CheckoutForm />
      </Elements>
    </>
  );
}

