import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../lib/auth';
import type { DeadlineStatus } from '@prisma/client';

function parseYMD(d: string): Date | null {
  // Expect YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return null;
  const [_, y, mo, da] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da), 0, 0, 0));
  return isNaN(dt.getTime()) ? null : dt;
}

function addBusinessDays(start: Date, days: number): Date {
  // Simple business-days addition skipping Sat/Sun
  let remaining = Math.max(0, Math.floor(days));
  let cur = new Date(start.getTime());
  while (remaining > 0) {
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
    const day = cur.getUTCDay(); // 0 Sun .. 6 Sat
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  // If falls on weekend, move forward to Monday
  const wd = cur.getUTCDay();
  if (wd === 0) cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  if (wd === 6) cur = new Date(cur.getTime() + 2 * 24 * 60 * 60 * 1000);
  return cur;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) return res.status(403).json({ error: 'No autorizado' });

  // Create
  if (req.method === 'POST') {
    const { caseId, title, startDate, termDays, notes } = req.body || {};
    if (!caseId || !title || startDate == null || termDays == null) {
      return res.status(400).json({ error: 'Datos requeridos: caseId, title, startDate, termDays' });
    }
    const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, userId: true, abogadoId: true } });
    if (!canAccessLegalCase(auth, lc, true)) return res.status(404).json({ error: 'Caso no encontrado' });
    const sd = typeof startDate === 'string' ? parseYMD(startDate) : new Date(startDate);
    if (!sd || isNaN(sd.getTime())) return res.status(400).json({ error: 'startDate inválida' });
    const td = Number(termDays);
    if (!Number.isFinite(td) || td < 0) return res.status(400).json({ error: 'termDays inválido' });
    const due = addBusinessDays(sd, td);
    const obj = await prisma.caseDeadline.create({
      data: {
        caseId: String(caseId),
        userId: auth.uid,
        title: String(title),
        startDate: sd,
        termDays: td,
        dueDate: due,
        status: 'PENDIENTE' as DeadlineStatus,
        notes: notes ? String(notes) : null
      }
    });
    await prisma.caseEvent.create({
      data: { caseId: String(caseId), type: 'STATUS', message: `Plazo registrado: ${obj.title} → vence ${due.toISOString().slice(0,10)}` }
    });
    return res.status(201).json({ id: obj.id, dueDate: obj.dueDate });
  }

  // List
  if (req.method === 'GET') {
    const { caseId, status, upcomingDays } = req.query || {};
    const where: any = {};
    if (auth.role !== 'ADMIN') {
      where.case = { is: { abogadoId: auth.uid } };
    }
    if (caseId) {
      where.caseId = String(caseId);
      if (auth.role !== 'ADMIN') {
        const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, abogadoId: true, userId: true }});
        if (!canAccessLegalCase(auth, lc, true)) return res.status(403).json({ error: 'No autorizado' });
      }
    }
    if (status) where.status = String(status).toUpperCase();
    if (upcomingDays) {
      const n = Math.max(0, Number(upcomingDays) || 0);
      const today = new Date();
      const end = new Date(today.getTime() + n * 24 * 60 * 60 * 1000);
      where.dueDate = { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())), lte: end };
    }
    const items = await prisma.caseDeadline.findMany({ where, orderBy: { dueDate: 'asc' } });
    return res.status(200).json({ deadlines: items });
  }

  // Update
  if (req.method === 'PUT') {
    const { id, title, startDate, termDays, notes, status } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.caseDeadline.findUnique({ where: { id: String(id) } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    // Ownership via case
    const lc = await prisma.legalCase.findUnique({ where: { id: before.caseId }, select: { id: true, userId: true, abogadoId: true } });
    if (!canAccessLegalCase(auth, lc, true)) return res.status(403).json({ error: 'No autorizado' });
    let sd = startDate ? (typeof startDate === 'string' ? parseYMD(startDate) : new Date(startDate)) : new Date(before.startDate);
    if (!sd || isNaN(sd.getTime())) sd = new Date(before.startDate);
    const td = termDays != null ? Math.max(0, Number(termDays)) : before.termDays;
    const due = addBusinessDays(sd, td);
    const nextStatus: DeadlineStatus = status
      ? (String(status).toUpperCase() as DeadlineStatus)
      : (before.status as unknown as DeadlineStatus);
    const updated = await prisma.caseDeadline.update({
      where: { id: String(id) },
      data: {
        title: title != null ? String(title) : before.title,
        startDate: sd,
        termDays: td,
        dueDate: due,
        notes: notes !== undefined ? (notes ? String(notes) : null) : before.notes,
        status: nextStatus
      }
    });
    await prisma.caseEvent.create({
      data: {
        caseId: updated.caseId,
        type: 'STATUS',
        message: `Plazo actualizado: ${updated.title} → vence ${updated.dueDate.toISOString().slice(0,10)} (${updated.status})`
      }
    });
    return res.status(200).json({ id: updated.id, dueDate: updated.dueDate });
  }

  // Delete
  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : null;
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.caseDeadline.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    const lc = await prisma.legalCase.findUnique({ where: { id: before.caseId }, select: { id: true, userId: true, abogadoId: true } });
    if (!canAccessLegalCase(auth, lc, true)) return res.status(403).json({ error: 'No autorizado' });
    await prisma.caseDeadline.delete({ where: { id } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
