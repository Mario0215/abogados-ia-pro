import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

const STATUS_PRO = new Set([
  'NUEVO', 'ASIGNADO', 'EN_REVISION', 'EN_REDACCION',
  'DEMANDA_LISTA', 'PRESENTADO', 'SEGUIMIENTO', 'CERRADO', 'ARCHIVADO'
]);
const STATUS_PRO_LABEL: Record<string, string> = {
  NUEVO: 'Nuevo',
  ASIGNADO: 'Asignado',
  EN_REVISION: 'En revisión',
  EN_REDACCION: 'En redacción',
  DEMANDA_LISTA: 'Demanda lista',
  PRESENTADO: 'Presentado',
  SEGUIMIENTO: 'Seguimiento',
  CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado'
};
const STATUS_PRO_ERROR = 'Estado operativo inválido. Valores permitidos: NUEVO, ASIGNADO, EN_REVISION, EN_REDACCION, DEMANDA_LISTA, PRESENTADO, SEGUIMIENTO, CERRADO, ARCHIVADO.';
const ABOGADO_ID_ERROR = 'abogadoId inválido. Requiere usuario con role=ABOGADO y active=true, o null para desasignar.';
const STATUS_VACIO_ERROR = 'status no puede ser null, vacío o solo espacios. Si no desea modificarlo, omita el campo.';

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

function parseOptionalMoney(value: unknown, field: string): number | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, `${field} debe ser un importe positivo.`, 'INVALID_MONEY');
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function sameMoney(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

function adminLabel(auth: { name?: string; email?: string; uid: string }) {
  return auth.name || auth.email || auth.uid;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  // GET — listar todos los casos con cliente y abogado asignado
  if (req.method === 'GET') {
    const { ciudad, estadoAsignacion, q, status, sinAsignar } = req.query;
    const where: any = { isActive: true };
    if (ciudad && String(ciudad) !== 'TODAS') where.ciudad = String(ciudad);
    if (estadoAsignacion && String(estadoAsignacion) !== 'TODOS') where.estadoAsignacion = String(estadoAsignacion);
    if (status && String(status) !== 'TODOS') {
      const ns = normalizeStatus(status);
      if (ns) where.status = ns;
    }
    if (sinAsignar === '1') where.abogadoId = null;
    if (q && String(q).trim()) {
      const like = String(q).trim();
      where.OR = [
        { expediente: { contains: like, mode: 'insensitive' } },
        { expedienteReal: { contains: like, mode: 'insensitive' } },
        { intent: { contains: like, mode: 'insensitive' } },
        { courtNumber: { contains: like, mode: 'insensitive' } },
        { client: { name: { contains: like, mode: 'insensitive' } } },
      ];
    }

    const casos = await (prisma as any).legalCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        expediente: true,
        expedienteReal: true,
        intent: true,
        matter: true,
        status: true,
        estadoAsignacion: true,
        estatusCliente: true,
        ciudad: true,
        courtNumber: true,
        courtType: true,
        notes: true,
        precioCliente: true,
        honorarioAbogado: true,
        honorarioAbogadoAcordadoAt: true,
        honorarioAbogadoAcordadoPorId: true,
        createdAt: true,
        client: { select: { id: true, name: true, phone: true, email: true } },
        abogado: { select: { id: true, name: true, ciudad: true, specialty: true } },
        user: { select: { id: true, name: true } },
      },
    });

    const abogadosRaw = await (prisma as any).user.findMany({
      where: { role: 'ABOGADO', active: true },
      select: { id: true, name: true, ciudad: true, specialty: true, phone: true },
      orderBy: { name: 'asc' },
    });

    const abogadoIds = abogadosRaw.map((a: any) => a.id);
    let countsMap: Record<string, number> = {};
    if (abogadoIds.length > 0) {
      const countsActivos = await (prisma as any).legalCase.groupBy({
        by: ['abogadoId'],
        where: { abogadoId: { in: abogadoIds }, isActive: true, NOT: { status: { in: ['CERRADO', 'ARCHIVADO'] } } },
        _count: { _all: true }
      });
      countsMap = Object.fromEntries(countsActivos.map((r: any) => [r.abogadoId, r._count._all]));
    }
    const abogados = abogadosRaw.map((a: any) => ({ ...a, activosAsignados: countsMap[a.id] || 0 }));

    return res.status(200).json({
      casos: casos.map((c: any) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      abogados,
      statusPro: STATUS_PRO_LABEL,
    });
  }

  // PATCH — asignar abogado + precios + estadoAsignacion + estados PRO + datos judiciales
  if (req.method === 'PATCH') {
    const { caseId, abogadoId, precioCliente, honorarioAbogado, estadoAsignacion, ciudad, estatusCliente, status, courtNumber, courtType, expedienteReal, notes } = req.body || {};
    if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

    // ===== VALIDACIÓN ESTRICTA STATUS =====
    // Si status no viene (undefined) → NO se modifica.
    // Si viene null/vacío/whitespace → 400 (nunca se envía null a la columna).
    // Si viene valor fuera de allowlist → 400.
    let normStatus: string | undefined = undefined;
    if (typeof status !== 'undefined') {
      const asStr = status == null ? '' : String(status).trim();
      if (asStr.length === 0) return res.status(400).json({ error: STATUS_VACIO_ERROR });
      if (!STATUS_PRO.has(asStr)) return res.status(400).json({ error: STATUS_PRO_ERROR });
      normStatus = asStr;
    }

    // ===== VALIDACIÓN ESTRICTA ABOGADOID =====
    // null o '' explícito → desasignar permitido.
    // Otro valor → debe existir + role ABOGADO + active true.
    let normAbogadoId: string | null | undefined = undefined;
    if (typeof abogadoId !== 'undefined') {
      if (abogadoId === null || (typeof abogadoId === 'string' && abogadoId.trim() === '')) {
        normAbogadoId = null;
      } else {
        const checkId = String(abogadoId).trim();
        const exists = await (prisma as any).user.findUnique({ where: { id: checkId }, select: { role: true, active: true } });
        if (!exists || exists.role !== 'ABOGADO' || !exists.active) return res.status(400).json({ error: ABOGADO_ID_ERROR });
        normAbogadoId = checkId;
      }
    }

    try {
      const result: any = await (prisma as any).$transaction(async (tx: any) => {
        const before: any = await tx.legalCase.findUnique({
          where: { id: caseId },
          select: {
            expediente: true,
            status: true,
            abogadoId: true,
            precioCliente: true,
            honorarioAbogado: true,
            honorarioAbogadoAcordadoAt: true,
            honorarioAbogadoAcordadoPorId: true,
            client: { select: { name: true, email: true } },
          },
        });
        if (!before) throw new ApiError(404, 'Caso no encontrado');

        const lawyerPayments: any[] = await tx.lawyerPayment.findMany({
          where: { caseId },
          select: { status: true, voidedAt: true },
        });
        const hasLawyerPaymentHistory = lawyerPayments.some((payment) => payment.status === 'CONFIRMADO' || !!payment.voidedAt);
        const abogadoChanged = typeof normAbogadoId !== 'undefined' && normAbogadoId !== before.abogadoId;
        const isReassignment = abogadoChanged && before.abogadoId !== null;

        if (isReassignment && hasLawyerPaymentHistory) {
          throw new ApiError(409, 'La reasignación requiere resolución administrativa porque existen pagos al abogado.', 'LAWYER_REASSIGNMENT_BLOCKED_WITH_PAYMENTS');
        }
        if (isReassignment && typeof honorarioAbogado !== 'undefined') {
          throw new ApiError(409, 'Primero reasigne el caso; el nuevo abogado requiere un acuerdo manual de honorario separado.', 'HONORARIO_REQUIRES_NEW_AGREEMENT_AFTER_REASSIGNMENT');
        }

        const data: any = {};
        const events: any[] = [];
        const actor = adminLabel(auth);

        if (typeof normAbogadoId !== 'undefined') {
          data.abogadoId = normAbogadoId;
          if (normAbogadoId !== null && typeof estadoAsignacion === 'undefined') data.estadoAsignacion = 'ASIGNADO';
          if (abogadoChanged) {
            if (normAbogadoId) {
              const abg: any = await tx.user.findUnique({ where: { id: normAbogadoId }, select: { name: true } });
              events.push({ caseId, type: 'STATUS', message: `Asignado a: ${abg?.name || normAbogadoId}` });
            } else {
              events.push({ caseId, type: 'STATUS', message: 'Asignación removida (sin abogado)' });
            }
          }
        }

        if (isReassignment) {
          data.honorarioAbogado = null;
          data.honorarioAbogadoAcordadoAt = null;
          data.honorarioAbogadoAcordadoPorId = null;
          events.push({
            caseId,
            type: 'HONORARIO_LIMPIADO_REASIGNACION',
            message: `ADMIN ${actor} limpió el honorario acordado por reasignación; el nuevo abogado requiere acuerdo manual.`,
          });
        }

        if (typeof precioCliente !== 'undefined') {
          if (precioCliente === null || (typeof precioCliente === 'string' && precioCliente.trim() === '')) {
            data.precioCliente = null;
          } else {
            data.precioCliente = parseOptionalMoney(precioCliente, 'precioCliente');
          }
        }

        if (typeof honorarioAbogado !== 'undefined') {
          const proposedHonorario = parseOptionalMoney(honorarioAbogado, 'honorarioAbogado');
          const effectiveLawyerId = typeof normAbogadoId !== 'undefined' ? normAbogadoId : before.abogadoId;
          const changedHonorario = !sameMoney(before.honorarioAbogado, proposedHonorario) || !before.honorarioAbogadoAcordadoAt || !before.honorarioAbogadoAcordadoPorId;

          if (hasLawyerPaymentHistory && changedHonorario) {
            throw new ApiError(409, 'El honorario acordado está bloqueado porque existe un pago al abogado.', 'HONORARIO_LOCKED_AFTER_PAYMENT');
          }
          if (proposedHonorario !== null && !effectiveLawyerId) {
            throw new ApiError(400, 'Asigne primero un abogado activo antes de acordar honorarios.', 'HONORARIO_REQUIRES_LAWYER');
          }

          if (changedHonorario && !hasLawyerPaymentHistory) {
            data.honorarioAbogado = proposedHonorario;
            data.honorarioAbogadoAcordadoAt = proposedHonorario === null ? null : new Date();
            data.honorarioAbogadoAcordadoPorId = proposedHonorario === null ? null : auth.uid;
            events.push({
              caseId,
              type: before.honorarioAbogado == null || !before.honorarioAbogadoAcordadoAt ? 'HONORARIO_ACORDADO' : 'HONORARIO_MODIFICADO',
              from: before.honorarioAbogado == null ? null : String(before.honorarioAbogado),
              to: proposedHonorario == null ? null : String(proposedHonorario),
              message: proposedHonorario == null
                ? `ADMIN ${actor} retiró el honorario acordado.`
                : `ADMIN ${actor} ${before.honorarioAbogado == null || !before.honorarioAbogadoAcordadoAt ? 'acordó' : 'modificó'} el honorario a $${proposedHonorario.toLocaleString('es-MX')}.`,
            });
          }
        }

        if (typeof estadoAsignacion !== 'undefined') data.estadoAsignacion = String(estadoAsignacion);
        if (typeof ciudad !== 'undefined') data.ciudad = ciudad ? String(ciudad).trim() : null;
        if (typeof estatusCliente !== 'undefined') data.estatusCliente = String(estatusCliente);
        if (typeof normStatus !== 'undefined') data.status = normStatus;
        if (typeof courtNumber !== 'undefined') data.courtNumber = courtNumber ? String(courtNumber).trim() : null;
        if (typeof courtType !== 'undefined') data.courtType = courtType ? String(courtType).trim() : null;
        if (typeof expedienteReal !== 'undefined') data.expedienteReal = expedienteReal ? String(expedienteReal).trim() : null;
        if (typeof notes !== 'undefined') data.notes = notes ? String(notes).trim() : null;
        if (!Object.keys(data).length) throw new ApiError(400, 'Sin cambios');

        const caso: any = await tx.legalCase.update({
          where: { id: caseId },
          data,
          select: {
            expediente: true,
            status: true,
            abogadoId: true,
            estatusCliente: true,
            client: { select: { name: true, email: true } },
          },
        });

        if (typeof data.status !== 'undefined' && before.status !== caso.status) {
          events.push({ caseId, type: 'STATUS', from: before.status || null, to: caso.status, message: `Estado: ${before.status || '(vacio)'} → ${caso.status || '(vacio)'}` });
        }
        if (events.length) await tx.caseEvent.createMany({ data: events });

        return { caso, notifyClient: typeof data.estatusCliente !== 'undefined' };
      }, { isolationLevel: 'Serializable' });

      if (result.notifyClient && result.caso?.client?.email) {
        try {
          const { sendEstatusClienteEmail } = await import('../../../lib/email');
          await sendEstatusClienteEmail({
            toEmail: result.caso.client.email,
            toName: result.caso.client.name || 'Cliente',
            expediente: result.caso.expediente,
            nuevoEstatus: result.caso.estatusCliente,
          });
        } catch (emailErr: unknown) {
          const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error(`[casos:PATCH:email] Fallo envio correo expediente=${result.caso.expediente} error=${msg.slice(0, 200)}`);
        }
      }

      return res.status(200).json({ ok: true, caso: { expediente: result.caso.expediente, status: result.caso.status } });
    } catch (error: unknown) {
      if (error instanceof ApiError) return res.status(error.status).json({ error: error.message, code: error.code });
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[casos:PATCH] caseId=${caseId} error=${message.slice(0, 200)}`);
      return res.status(500).json({ error: 'No se pudo actualizar el caso.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
