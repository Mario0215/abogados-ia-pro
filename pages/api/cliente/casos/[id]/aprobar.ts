import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { getClienteFromCookies } from '../../../../../lib/cliente-auth';
import { sendAprobacionAbogadoEmail } from '../../../../../lib/email';
import { getCaseFinancialSummary } from '../../../../../lib/finance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Método no permitido' });

  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  const caseId = req.query.id as string;
  if (!caseId) return res.status(400).json({ error: 'ID de expediente requerido' });

  try {
    // Verificar que el portal user tiene un client vinculado
    const portalUser: any = await (prisma as any).clientPortalUser.findUnique({
      where: { id: auth.uid },
      select: { clientId: true },
    });

    if (!portalUser?.clientId) return res.status(403).json({ error: 'Sin expedientes vinculados' });

    // Verificar que el caso pertenece a este cliente
    const caso: any = await (prisma as any).legalCase.findFirst({
      where: { id: caseId, clientId: portalUser.clientId, isActive: true },
      select: { id: true, estatusCliente: true, precioCliente: true },
    });

    if (!caso) return res.status(404).json({ error: 'Expediente no encontrado' });

    try {
      const financial = await getCaseFinancialSummary(prisma as any, caso.id);
      const precio = typeof financial?.precioCliente === 'number' ? Number(financial.precioCliente) : 0;
      const required = precio > 0 ? Math.round(precio * 0.5) : 0;
      if (required > 0) {
        const paid = Number(financial?.totalCobrado || 0);
        if (paid < required) return res.status(402).json({ error: 'Pago pendiente', required, paid });
      }
    } catch {
      return res.status(503).json({ error: 'No fue posible validar el estado de pago del expediente.' });
    }

    // Cambiar estatusCliente a APROBADA
    const updated: any = await (prisma as any).legalCase.update({
      where: { id: caso.id },
      data: { estatusCliente: 'APROBADA' },
      select: {
        expediente: true,
        client: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    // Avisar al abogado
    if (updated?.user?.email) {
      sendAprobacionAbogadoEmail({
        toEmail: updated.user.email,
        toName: updated.user.name || 'Abogado',
        clientName: updated.client?.name || 'El cliente',
        expediente: updated.expediente,
      });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
