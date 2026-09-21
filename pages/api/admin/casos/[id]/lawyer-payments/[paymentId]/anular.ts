import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromCookies } from '../../../../../../../lib/auth';
import { prisma } from '../../../../../../../lib/prisma';

function actorLabel(auth: { name?: string; email?: string; uid: string }) {
  return auth.name || auth.email || auth.uid;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const caseId = String(req.query.id || '').trim();
  const paymentId = String(req.query.paymentId || '').trim();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!caseId || !paymentId) return res.status(400).json({ error: 'caseId y paymentId requeridos.' });
  if (!reason) return res.status(400).json({ error: 'El motivo de anulación es requerido.' });

  const result: any = await (prisma as any).$transaction(async (tx: any) => {
    const payment: any = await tx.lawyerPayment.findFirst({ where: { id: paymentId, caseId } });
    if (!payment) return null;
    if (payment.status === 'ANULADO') return { payment, idempotent: true };

    const updated = await tx.lawyerPayment.update({
      where: { id: paymentId },
      data: {
        status: 'ANULADO',
        voidedAt: new Date(),
        voidedByAdminId: auth.uid,
        voidReason: reason,
      },
    });
    await tx.caseEvent.create({
      data: {
        caseId,
        type: 'PAGO_ABOGADO_ANULADO',
        message: `ADMIN ${actorLabel(auth)} anuló el pago al abogado por $${Number(payment.amount).toLocaleString('es-MX')}. Motivo: ${reason}`,
      },
    });
    return { payment: updated, idempotent: false };
  }, { isolationLevel: 'Serializable' });

  if (!result) return res.status(404).json({ error: 'Pago no encontrado.' });
  return res.status(200).json(result);
}
