import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { prisma } from '../../../lib/prisma';
import { getClienteFromCookies } from '../../../lib/cliente-auth';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' as any }) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!stripe) return res.status(500).json({ error: 'STRIPE_SECRET_KEY no configurada' });

  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  const { monto, metadata } = req.body || {};
  const amountMx = Number(monto);
  if (!Number.isFinite(amountMx) || amountMx < 1) return res.status(400).json({ error: 'Monto inválido' });

  const tipoServicio = String(metadata?.tipoServicio || '').trim();
  const datosPersonales = String(metadata?.datosPersonales || '').trim();
  const respuestas = String(metadata?.respuestas || '').trim();
  if (!tipoServicio || !datosPersonales || !respuestas) {
    return res.status(400).json({ error: 'Metadata incompleta' });
  }

  const respuestasObj = (() => { try { return JSON.parse(respuestas || '{}'); } catch { return null; } })();
  if (!respuestasObj) return res.status(400).json({ error: 'Respuestas inválidas' });

  const svc: any = await (prisma as any).servicioConfig.findUnique({ where: { servicioId: tipoServicio } });
  if (!svc || svc.activo === false) return res.status(400).json({ error: 'Tipo de servicio no válido' });
  const modsArr: any[] = await (prisma as any).precioModificador.findMany();
  const mods = new Map<string, number>(modsArr.map((m: any) => [String(m.key), Number(m.valor)]));
  let cotizacion = Number(svc.precioBase) || 0;
  if (tipoServicio === 'DIVORCIO_CONTENCIOSO') cotizacion += mods.get('EXTRA_CONTENCIOSO') || 0;
  if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio)) {
    if (respuestasObj?.tieneHijos === 'si') {
      const n = Math.max(parseInt(respuestasObj?.numHijos || '1'), 1);
      cotizacion += n * (mods.get('EXTRA_HIJO') || 0);
    }
    if (respuestasObj?.bienesComun === 'si') cotizacion += mods.get('EXTRA_BIENES') || 0;
  }
  if (tipoServicio === 'PENSION_ALIMENTICIA') {
    const n = Math.max(parseInt(respuestasObj?.numHijos || '0'), 0);
    if (n > 0) cotizacion += n * (mods.get('EXTRA_HIJO') || 0);
  }
  if (!Number.isFinite(cotizacion) || cotizacion <= 0) return res.status(400).json({ error: 'Cotización inválida' });

  const anticipo = Math.round(cotizacion * 0.5);
  if (Math.round(amountMx) !== anticipo) return res.status(400).json({ error: 'Monto inválido para anticipo' });

  const draft = await (prisma as any).stripePaymentDraft.create({
    data: {
      portalUserId: auth.uid,
      tipoServicio,
      datosPersonales,
      respuestas,
      cotizacion,
    },
    select: { id: true },
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountMx * 100),
    currency: 'mxn',
    metadata: {
      draftId: draft.id,
    },
    automatic_payment_methods: { enabled: true },
  });

  return res.status(200).json({ clientSecret: paymentIntent.client_secret });
}
