export type ComputedDeadlineStatus = 'PENDIENTE' | 'CUMPLIDO' | 'CANCELADO' | 'VENCIDO';

export type AlertVariant = 'red' | 'amber' | 'blue' | 'muted' | 'green' | 'gray';

export interface DeadlineAlert {
  label: string;
  variant: AlertVariant;
  daysDiff: number;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function computeDeadlineStatus(dueDateISO: string | Date, dbStatus: string): ComputedDeadlineStatus {
  if (dbStatus === 'CUMPLIDO' || dbStatus === 'CANCELADO') return dbStatus as ComputedDeadlineStatus;
  const due = dueDateISO instanceof Date ? dueDateISO : new Date(dueDateISO);
  if (isNaN(due.getTime())) return 'PENDIENTE';
  const todayStart = startOfDayUTC(new Date());
  const dueStart = startOfDayUTC(due);
  return dueStart.getTime() < todayStart.getTime() ? 'VENCIDO' : 'PENDIENTE';
}

export function computeDeadlineAlert(dueDateISO: string | Date, dbStatus: string): DeadlineAlert {
  const computed = computeDeadlineStatus(dueDateISO, dbStatus);
  if (computed === 'CUMPLIDO') return { label: 'Cumplido', variant: 'green', daysDiff: 0 };
  if (computed === 'CANCELADO') return { label: 'Cancelado', variant: 'gray', daysDiff: 0 };
  const due = dueDateISO instanceof Date ? dueDateISO : new Date(dueDateISO);
  if (isNaN(due.getTime())) return { label: '', variant: 'muted', daysDiff: 0 };
  const todayStart = startOfDayUTC(new Date());
  const dueStart = startOfDayUTC(due);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((dueStart.getTime() - todayStart.getTime()) / msPerDay);
  if (computed === 'VENCIDO') return { label: 'VENCIDO', variant: 'red', daysDiff };
  if (daysDiff === 0) return { label: 'Vence hoy', variant: 'red', daysDiff: 0 };
  if (daysDiff <= 1) return { label: 'En 1 día', variant: 'amber', daysDiff };
  if (daysDiff <= 3) return { label: 'En 3 días', variant: 'amber', daysDiff };
  if (daysDiff <= 5) return { label: 'En 5 días', variant: 'blue', daysDiff };
  return { label: '', variant: 'muted', daysDiff };
}
