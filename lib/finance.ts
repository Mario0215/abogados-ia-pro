type ClientPaymentLike = {
  amount: number;
  tipo: string;
  estado: string;
};

type LawyerPaymentLike = {
  amount: number;
  status: string;
  voidedAt?: Date | string | null;
};

export type ClientFinanceSummary = {
  anticipoCobrado: number;
  pagosCliente: number;
  reembolsosCliente: number;
  totalCobrado: number;
  saldoCliente: number;
  anticipoConfirmado: boolean;
};

export type LawyerFinanceSummary = {
  honorarioAcordado: number | null;
  honorarioPagado: number;
  saldoPorLiquidar: number | null;
  huboPagoConfirmado: boolean;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? money(amount) : 0;
}

export function calculateClientFinance(precioCliente: number | null | undefined, payments: ClientPaymentLike[]): ClientFinanceSummary {
  let anticipoCobrado = 0;
  let pagosCliente = 0;
  let reembolsosCliente = 0;

  for (const payment of payments) {
    if (payment.estado !== 'CONFIRMADO') continue;
    const amount = safeAmount(payment.amount);
    if (payment.tipo === 'ANTICIPO_CLIENTE') anticipoCobrado += amount;
    if (payment.tipo === 'PAGO_CLIENTE') pagosCliente += amount;
    if (payment.tipo === 'REEMBOLSO_CLIENTE') reembolsosCliente += amount;
  }

  anticipoCobrado = money(anticipoCobrado);
  pagosCliente = money(pagosCliente);
  reembolsosCliente = money(reembolsosCliente);
  const totalCobrado = money(anticipoCobrado + pagosCliente - reembolsosCliente);
  const price = safeAmount(precioCliente);

  return {
    anticipoCobrado,
    pagosCliente,
    reembolsosCliente,
    totalCobrado,
    saldoCliente: money(Math.max(price - totalCobrado, 0)),
    anticipoConfirmado: anticipoCobrado > 0,
  };
}

export function calculateLawyerFinance(honorarioAbogado: number | null | undefined, payments: LawyerPaymentLike[]): LawyerFinanceSummary {
  const honorario = honorarioAbogado == null ? null : safeAmount(honorarioAbogado);
  let honorarioPagado = 0;
  let huboPagoConfirmado = false;

  for (const payment of payments) {
    if (payment.status === 'CONFIRMADO') {
      honorarioPagado += safeAmount(payment.amount);
      huboPagoConfirmado = true;
    }
    // Un pago posteriormente anulado sigue bloqueando cambios silenciosos al acuerdo.
    if (payment.voidedAt) huboPagoConfirmado = true;
  }

  honorarioPagado = money(honorarioPagado);
  return {
    honorarioAcordado: honorario,
    honorarioPagado,
    saldoPorLiquidar: honorario == null ? null : money(Math.max(honorario - honorarioPagado, 0)),
    huboPagoConfirmado,
  };
}

export async function getCaseFinancialSummary(db: any, caseId: string) {
  const [caseRecord, clientPayments, lawyerPayments] = await Promise.all([
    db.legalCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        abogadoId: true,
        precioCliente: true,
        honorarioAbogado: true,
        honorarioAbogadoAcordadoAt: true,
        honorarioAbogadoAcordadoPorId: true,
      },
    }),
    db.casePayment.findMany({
      where: { caseId },
      select: { amount: true, tipo: true, estado: true },
    }),
    db.lawyerPayment.findMany({
      where: { caseId },
      select: { amount: true, status: true, voidedAt: true },
    }),
  ]);

  if (!caseRecord) return null;
  const cliente = calculateClientFinance(caseRecord.precioCliente, clientPayments);
  const abogado = calculateLawyerFinance(caseRecord.honorarioAbogado, lawyerPayments);

  return {
    caseId: caseRecord.id,
    abogadoId: caseRecord.abogadoId,
    precioCliente: caseRecord.precioCliente == null ? null : money(Number(caseRecord.precioCliente)),
    honorarioConfirmado: !!caseRecord.honorarioAbogadoAcordadoAt && !!caseRecord.honorarioAbogadoAcordadoPorId,
    ...cliente,
    ...abogado,
  };
}
