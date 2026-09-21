import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { prisma } from '../../../lib/prisma';
import { ABOGADO_ADMIN_ID } from '../../../lib/cliente-config';
import { sendEmail } from '../../../lib/email';
import { buildBienvenidaEmail } from '../../../lib/email-bienvenida';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' as any }) : null;

export const config = { api: { bodyParser: false } };

async function buffer(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!stripe) return res.status(500).end();

  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) return res.status(400).json({ error: 'Falta stripe-signature' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET no configurada' });

  const buf = await buffer(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch {
    return res.status(400).json({ error: 'Webhook signature inválida' });
  }

  if (event.type !== 'payment_intent.succeeded') return res.status(200).end();

  const pi = event.data.object as Stripe.PaymentIntent;
  const draftId = String(pi.metadata?.draftId || '').trim();
  if (!draftId) return res.status(200).end();

  const idempotencyKey = `stripe:pi:${pi.id}`;
  const existe = await prisma.legalCase.findFirst({ where: { stripePaymentIntentId: pi.id }, select: { id: true } });
  if (existe) {
    const payment = await (prisma as any).casePayment.findUnique({ where: { idempotencyKey }, select: { id: true } });
    if (payment) return res.status(200).end();
  }

  const draft: any = await (prisma as any).stripePaymentDraft.findUnique({ where: { id: draftId } });
  if (!draft) return res.status(200).end();

  let adminId = ABOGADO_ADMIN_ID;
  if (!adminId) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, select: { id: true } });
    if (!admin) return res.status(500).end();
    adminId = admin.id;
  }

  const portalUser: any = await (prisma as any).clientPortalUser.findUnique({
    where: { id: draft.portalUserId },
    include: { client: true },
  });
  if (!portalUser) return res.status(200).end();

  const datosPersonales = (() => { try { return JSON.parse(draft.datosPersonales || '{}'); } catch { return {}; } })();
  const respuestas = (() => { try { return JSON.parse(draft.respuestas || '{}'); } catch { return {}; } })();
  const tipoServicio = String(draft.tipoServicio || '').trim();
  if (!tipoServicio) return res.status(200).end();

  const svc: any = await (prisma as any).servicioConfig.findUnique({ where: { servicioId: tipoServicio } });
  if (!svc || svc.activo === false) return res.status(200).end();
  const modsArr: any[] = await (prisma as any).precioModificador.findMany();
  const mods = new Map<string, number>(modsArr.map((m: any) => [String(m.key), Number(m.valor)]));
  let cotizacion = Number(svc.precioBase) || 0;
  if (tipoServicio === 'DIVORCIO_CONTENCIOSO') cotizacion += mods.get('EXTRA_CONTENCIOSO') || 0;
  if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio)) {
    if (respuestas?.tieneHijos === 'si') {
      const n = Math.max(parseInt(respuestas?.numHijos || '1'), 1);
      cotizacion += n * (mods.get('EXTRA_HIJO') || 0);
    }
    if (respuestas?.bienesComun === 'si') cotizacion += mods.get('EXTRA_BIENES') || 0;
  }
  if (tipoServicio === 'PENSION_ALIMENTICIA') {
    const n = Math.max(parseInt(respuestas?.numHijos || '0'), 0);
    if (n > 0) cotizacion += n * (mods.get('EXTRA_HIJO') || 0);
  }
  if (!Number.isFinite(cotizacion) || cotizacion <= 0) return res.status(200).end();

  let clientId = portalUser.clientId as string | null;
  if (!clientId) {
    const newClient = await (prisma as any).client.create({
      data: {
        userId: adminId,
        name: String(datosPersonales.nombre || '').trim(),
        phone: datosPersonales.telefono ? String(datosPersonales.telefono).trim() : null,
        email: datosPersonales.correo ? String(datosPersonales.correo).trim() : null,
        address: datosPersonales.domicilio ? String(datosPersonales.domicilio).trim() : null,
        ciudad: datosPersonales.ciudad ? String(datosPersonales.ciudad).trim() : null,
      },
    });
    clientId = newClient.id as string;
    await (prisma as any).clientPortalUser.update({ where: { id: portalUser.id }, data: { clientId } });
  }

  const anticipo = Math.round(cotizacion * 0.5);
  const anticipoPagadoMonto = Math.round((Number((pi as any).amount_received || pi.amount || 0) / 100) || 0);

  const contraparteMap: Record<string, string> = {
    DIVORCIO_MUTUO: 'nombreConyuge',
    DIVORCIO_CONTENCIOSO: 'nombreConyuge',
    PENSION_ALIMENTICIA: 'nombreObligado',
    NULIDAD_CONTRATO: 'nombreContraparte',
    DANOS_PERJUICIOS: 'nombreResponsable',
    SUCESION: 'nombreFallecido',
  };
  const counterpartyKey = contraparteMap[tipoServicio] || '';
  const counterparty = (counterpartyKey && respuestas?.[counterpartyKey]) ? String(respuestas[counterpartyKey]).trim() : '';

  const templates: Record<string, Array<{ key: string; label: string }>> = {
    DIVORCIO_MUTUO: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del solicitante' },
      { key: 'INE_CONTRAPARTE', label: 'Identificación oficial (INE) de la contraparte' },
      { key: 'ACTA_MATRIMONIO', label: 'Acta de matrimonio' },
      { key: 'ACTA_NAC_HIJOS', label: 'Actas de nacimiento de hijos (si aplica)' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
    ],
    DIVORCIO_CONTENCIOSO: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del actor' },
      { key: 'ACTA_MATRIMONIO', label: 'Acta de matrimonio' },
      { key: 'ACTA_NAC_HIJOS', label: 'Actas de nacimiento de hijos (si aplica)' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
      { key: 'PRUEBAS', label: 'Documentos/pruebas relacionadas (si aplica)' },
    ],
    PENSION_ALIMENTICIA: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del promovente' },
      { key: 'ACTA_NAC_MENORES', label: 'Actas de nacimiento de los menores' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
      { key: 'DATOS_DEMANDADO', label: 'Datos del obligado (si los tienes)' },
    ],
    SUCESION: [
      { key: 'INE_PROMOVENTE', label: 'Identificación oficial (INE) del promovente' },
      { key: 'ACTA_DEFUNCION', label: 'Acta de defunción' },
      { key: 'ACTA_NACIMIENTO', label: 'Acta de nacimiento del promovente' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
    ],
  };
  const template = templates[tipoServicio] || [
    { key: 'INE', label: 'Identificación oficial (INE)' },
    { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
  ];
  const docRequests = template.map((d, i) => ({
    id: `tpl_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
    key: d.key,
    label: d.label,
    status: 'PENDIENTE',
    createdAt: new Date().toISOString(),
  }));

  const registration: any = await (prisma as any).$transaction(async (tx: any) => {
    const existing = await tx.legalCase.findUnique({
      where: { stripePaymentIntentId: pi.id },
      select: { id: true, expediente: true },
    });

    if (existing) {
      const existingPayment = await tx.casePayment.findUnique({ where: { idempotencyKey } });
      if (!existingPayment) {
        await tx.casePayment.create({
          data: {
            caseId: existing.id,
            amount: anticipoPagadoMonto || anticipo,
            concept: 'Anticipo (Stripe)',
            tipo: 'ANTICIPO_CLIENTE',
            estado: 'CONFIRMADO',
            date: new Date(),
            notes: `payment_intent=${pi.id}`,
            referenciaExterna: pi.id,
            idempotencyKey,
          },
        });
      }
      return existing;
    }

    const count = await tx.legalCase.count();
    const expediente = `CPT-${String(count + 1).padStart(5, '0')}`;
    const legalCase = await tx.legalCase.create({
      data: {
        userId: adminId,
        clientId,
        abogadoId: null,
        type: 'CREAR',
        matter: 'CIVIL',
        intent: tipoServicio,
        expediente,
        counterparty,
        ciudad: datosPersonales.ciudad ? String(datosPersonales.ciudad).trim() : null,
        estadoAsignacion: 'PENDIENTE',
        notes: JSON.stringify({ tipoServicio, datosPersonales, respuestas, docRequests }),
        precioCliente: cotizacion,
        honorarioAbogado: null,
        status: 'BORRADOR',
        isActive: true,
        stripePaymentIntentId: pi.id,
        anticipoPagado: true,
      },
      select: { id: true, expediente: true },
    });

    await tx.casePayment.create({
      data: {
        caseId: legalCase.id,
        amount: anticipoPagadoMonto || anticipo,
        concept: 'Anticipo (Stripe)',
        tipo: 'ANTICIPO_CLIENTE',
        estado: 'CONFIRMADO',
        date: new Date(),
        notes: `payment_intent=${pi.id}`,
        referenciaExterna: pi.id,
        idempotencyKey,
      },
    });
    return legalCase;
  }, { isolationLevel: 'Serializable' });

  const toEmail = datosPersonales.correo ? String(datosPersonales.correo).trim() : '';
  if (toEmail) {
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || '').trim() || `https://${req.headers.host}`;
    const nombre = String(datosPersonales.nombre || '').trim() || 'Cliente';
    const nombreServicio = String(svc.nombre || tipoServicio);
    await sendEmail({
      to: toEmail,
      subject: `Tu caso ha sido registrado — ${nombreServicio}`,
      html: buildBienvenidaEmail({
        nombre,
        tipoServicio,
        nombreServicio,
        cotizacion,
        anticipo,
        expediente: registration.expediente,
        baseUrl,
      }),
    });
  }

  await (prisma as any).stripePaymentDraft.delete({ where: { id: draftId } }).catch(() => {});

  return res.status(200).json({ received: true });
}
