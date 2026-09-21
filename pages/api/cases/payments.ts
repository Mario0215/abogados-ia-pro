import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

const PAYMENT_TYPES = new Set(['ANTICIPO_CLIENTE', 'PAGO_CLIENTE', 'REEMBOLSO_CLIENTE']);

function toMoney(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isPrismaCode(error: unknown, code: string) {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === code;
}

function matchesIdempotentPayment(payment: any, input: { caseId: string; amount: number; concept: string; tipo: string; date: Date; notes: string | null; referenciaExterna: string | null }) {
  return payment?.caseId === input.caseId
    && Number(payment.amount) === input.amount
    && payment.concept === input.concept
    && payment.tipo === input.tipo
    && new Date(payment.date).getTime() === input.date.getTime()
    && (payment.notes || null) === input.notes
    && (payment.referenciaExterna || null) === input.referenciaExterna;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  const caseId = String(req.query.caseId || '');
  if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

  if (req.method === 'GET') {
    const payments = await (prisma as any).casePayment.findMany({
      where: { caseId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        registradoPorAdmin: { select: { id: true, name: true, email: true } },
        anuladoPorAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    return res.json({ payments });
  }

  if (req.method === 'POST') {
    const { amount: rawAmount, concept, tipo, date, notes, referenciaExterna, idempotencyKey: rawKey } = req.body || {};
    const amount = toMoney(rawAmount);
    const paymentDate = date ? new Date(date) : null;
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : '';
    const tipoWasProvided = typeof tipo !== 'undefined' && tipo !== null && String(tipo).trim() !== '';
    const paymentType = tipoWasProvided ? String(tipo).trim() : 'PAGO_CLIENTE';
    if (amount === null) return res.status(400).json({ error: 'amount debe ser un importe positivo.' });
    if (!concept || !String(concept).trim() || !paymentDate || Number.isNaN(paymentDate.getTime())) return res.status(400).json({ error: 'Faltan campos válidos.' });
    if (!idempotencyKey || idempotencyKey.length > 200) return res.status(400).json({ error: 'idempotencyKey requerida.' });
    if (!PAYMENT_TYPES.has(paymentType)) return res.status(400).json({ error: 'tipo de movimiento inválido.' });

    const input = {
      caseId,
      amount,
      concept: String(concept).trim(),
      tipo: paymentType,
      date: paymentDate,
      notes: notes ? String(notes).trim() : null,
      referenciaExterna: referenciaExterna ? String(referenciaExterna).trim() : null,
    };
    const legalCase = await (prisma as any).legalCase.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!legalCase) return res.status(404).json({ error: 'Expediente no encontrado.' });

    const existing = await (prisma as any).casePayment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (!matchesIdempotentPayment(existing, input)) return res.status(409).json({ error: 'La clave de idempotencia ya fue usada con datos distintos.', code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' });
      return res.status(200).json({ payment: existing, idempotent: true });
    }

    try {
      const payment = await (prisma as any).casePayment.create({
        data: {
          caseId: input.caseId,
          amount: input.amount,
          concept: input.concept,
          tipo: input.tipo,
          estado: 'CONFIRMADO',
          date: input.date,
          notes: input.notes,
          referenciaExterna: input.referenciaExterna,
          idempotencyKey,
          registradoPorAdminId: auth.uid,
        },
      });
      return res.status(201).json({ payment, idempotent: false });
    } catch (error: unknown) {
      if (isPrismaCode(error, 'P2002')) {
        const existing = await (prisma as any).casePayment.findUnique({ where: { idempotencyKey } });
        if (matchesIdempotentPayment(existing, input)) return res.status(200).json({ payment: existing, idempotent: true });
        return res.status(409).json({ error: 'La clave de idempotencia ya fue usada con datos distintos.', code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' });
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[case-payments:POST] caseId=${caseId} error=${message.slice(0, 200)}`);
      return res.status(500).json({ error: 'No se pudo registrar el movimiento del cliente.' });
    }
  }

  if (req.method === 'PATCH') {
    const id = String(req.body?.id || req.query.id || '').trim();
    const reason = typeof req.body?.motivoAnulacion === 'string' ? req.body.motivoAnulacion.trim() : '';
    if (!id) return res.status(400).json({ error: 'id requerido.' });
    if (!reason) return res.status(400).json({ error: 'motivoAnulacion requerido.' });

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const payment = await tx.casePayment.findFirst({ where: { id, caseId } });
      if (!payment) return null;
      if (payment.estado === 'ANULADO') return { payment, idempotent: true };
      const updated = await tx.casePayment.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          anuladoAt: new Date(),
          anuladoPorAdminId: auth.uid,
          motivoAnulacion: reason,
        },
      });
      return { payment: updated, idempotent: false };
    }, { isolationLevel: 'Serializable' });

    if (!result) return res.status(404).json({ error: 'Movimiento no encontrado.' });
    return res.status(200).json(result);
  }

  if (req.method === 'DELETE') {
    return res.status(405).json({ error: 'Los movimientos financieros no se eliminan; use anulación trazable.' });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
