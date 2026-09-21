import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function toMoney(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isKnownMethod(value: unknown): value is 'TRANSFERENCIA' | 'EFECTIVO' | 'OTRO' {
  return value === 'TRANSFERENCIA' || value === 'EFECTIVO' || value === 'OTRO';
}

function actorLabel(auth: { name?: string; email?: string; uid: string }) {
  return auth.name || auth.email || auth.uid;
}

function isPrismaCode(error: unknown, code: string) {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === code;
}

function matchesIdempotentLawyerPayment(payment: any, input: { caseId: string; amount: number; paidAt: Date; method: string; reference: string | null; notes: string | null }) {
  return payment?.caseId === input.caseId
    && Number(payment.amount) === input.amount
    && new Date(payment.paidAt).getTime() === input.paidAt.getTime()
    && payment.method === input.method
    && (payment.reference || null) === input.reference
    && (payment.notes || null) === input.notes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  const caseId = String(req.query.id || '').trim();
  if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

  if (req.method === 'GET') {
    const payments = await (prisma as any).lawyerPayment.findMany({
      where: { caseId },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        lawyer: { select: { id: true, name: true, email: true } },
        recordedByAdmin: { select: { id: true, name: true, email: true } },
        voidedByAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    return res.status(200).json({ payments });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { amount: rawAmount, paidAt: rawPaidAt, method, reference, notes, idempotencyKey: rawKey } = req.body || {};
  const amount = toMoney(rawAmount);
  const paidAt = rawPaidAt ? new Date(rawPaidAt) : null;
  const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  if (amount === null) return res.status(400).json({ error: 'amount debe ser un importe positivo.', code: 'INVALID_MONEY' });
  if (!paidAt || Number.isNaN(paidAt.getTime())) return res.status(400).json({ error: 'paidAt inválido.' });
  if (!isKnownMethod(method)) return res.status(400).json({ error: 'method inválido.' });
  if (!idempotencyKey || idempotencyKey.length > 200) return res.status(400).json({ error: 'idempotencyKey requerido.' });
  const input = {
    caseId,
    amount,
    paidAt,
    method,
    reference: reference ? String(reference).trim() : null,
    notes: notes ? String(notes).trim() : null,
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created: any = await (prisma as any).$transaction(async (tx: any) => {
        const existing = await tx.lawyerPayment.findUnique({ where: { idempotencyKey } });
        if (existing) {
          if (!matchesIdempotentLawyerPayment(existing, input)) throw new ApiError(409, 'La clave de idempotencia ya fue usada con datos distintos.', 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
          return { payment: existing, idempotent: true };
        }

        const legalCase: any = await tx.legalCase.findUnique({
          where: { id: caseId },
          select: {
            id: true,
            expediente: true,
            abogadoId: true,
            honorarioAbogado: true,
            honorarioAbogadoAcordadoAt: true,
            honorarioAbogadoAcordadoPorId: true,
          },
        });
        if (!legalCase) throw new ApiError(404, 'Caso no encontrado.');
        if (!legalCase.abogadoId) throw new ApiError(409, 'El caso no tiene abogado asignado.', 'LAWYER_REQUIRED');
        if (!legalCase.honorarioAbogadoAcordadoAt || !legalCase.honorarioAbogadoAcordadoPorId || !Number.isFinite(Number(legalCase.honorarioAbogado)) || Number(legalCase.honorarioAbogado) <= 0) {
          throw new ApiError(409, 'ADMIN debe confirmar primero el honorario acordado.', 'HONORARIO_NOT_CONFIRMED');
        }

        const lawyer = await tx.user.findUnique({ where: { id: legalCase.abogadoId }, select: { id: true, role: true, active: true } });
        if (!lawyer || lawyer.role !== 'ABOGADO' || !lawyer.active) {
          throw new ApiError(409, 'El abogado asignado no está activo.', 'LAWYER_NOT_ACTIVE');
        }

        const anticipo = await tx.casePayment.findFirst({
          where: { caseId, tipo: 'ANTICIPO_CLIENTE', estado: 'CONFIRMADO' },
          select: { id: true },
        });
        if (!anticipo) throw new ApiError(409, 'Se requiere un anticipo confirmado del cliente antes de pagar al abogado.', 'ADVANCE_NOT_CONFIRMED');

        const paidRows: any[] = await tx.lawyerPayment.findMany({
          where: { caseId, status: 'CONFIRMADO' },
          select: { amount: true },
        });
        const alreadyPaid = Math.round((paidRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) + Number.EPSILON) * 100) / 100;
        const agreed = Math.round((Number(legalCase.honorarioAbogado) + Number.EPSILON) * 100) / 100;
        if (alreadyPaid + amount > agreed + 0.000001) {
          throw new ApiError(409, 'El pago excede el saldo del honorario acordado.', 'HONORARIO_EXCEEDED');
        }

        const payment = await tx.lawyerPayment.create({
          data: {
            caseId,
            lawyerId: legalCase.abogadoId,
            amount,
            paidAt,
            method,
            reference: input.reference,
            notes: input.notes,
            status: 'CONFIRMADO',
            idempotencyKey,
            recordedByAdminId: auth.uid,
          },
        });
        await tx.caseEvent.create({
          data: {
            caseId,
            type: 'PAGO_ABOGADO',
            message: `ADMIN ${actorLabel(auth)} registró pago al abogado por $${amount.toLocaleString('es-MX')}${input.reference ? ` (referencia: ${input.reference})` : ''}.`,
          },
        });
        return { payment, idempotent: false };
      }, { isolationLevel: 'Serializable' });

      return res.status(created.idempotent ? 200 : 201).json(created);
    } catch (error: unknown) {
      if (error instanceof ApiError) return res.status(error.status).json({ error: error.message, code: error.code });
      if (isPrismaCode(error, 'P2002')) {
        const existing = await (prisma as any).lawyerPayment.findUnique({ where: { idempotencyKey } });
        if (matchesIdempotentLawyerPayment(existing, input)) return res.status(200).json({ payment: existing, idempotent: true });
        return res.status(409).json({ error: 'La clave de idempotencia ya fue usada con datos distintos.', code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' });
      }
      if (isPrismaCode(error, 'P2034') && attempt < 2) continue;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[lawyer-payments:POST] caseId=${caseId} error=${message.slice(0, 200)}`);
      return res.status(500).json({ error: 'No se pudo registrar el pago al abogado.' });
    }
  }

  return res.status(409).json({ error: 'No se pudo registrar el pago por concurrencia. Intente de nuevo.', code: 'CONCURRENT_WRITE' });
}
