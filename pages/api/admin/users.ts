import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { getAuthFromCookies } from '../../../lib/auth';

const ALLOWED_SPECIALTIES = new Set(['CIVIL', 'FAMILIAR', 'LABORAL']);
const SPECIALTY_ERROR = 'Especialidad inválida. Valores permitidos: CIVIL, FAMILIAR, LABORAL.';
function normalizeSpecialty(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const { q, role, active, orderBy, sort, skip, take } = req.query || {};
    const where: any = {};
    if (q && String(q).trim()) {
      const like = String(q).trim();
      where.OR = [
        { name: { contains: like, mode: 'insensitive' } },
        { email: { contains: like, mode: 'insensitive' } }
      ];
    }
    if (role && (role === 'ADMIN' || role === 'ABOGADO')) where.role = String(role);
    if (typeof active !== 'undefined') {
      if (active === 'true') where.active = true;
      if (active === 'false') where.active = false;
    }
    const orderKey = ['name', 'email', 'createdAt'].includes(String(orderBy)) ? String(orderBy) : 'createdAt';
    const orderDir = String(sort) === 'asc' ? 'asc' : 'desc';
    const skipN = Number(skip) || 0;
    const takeN = Math.min(Math.max(Number(take) || 20, 1), 100);
    const [users, total] = await Promise.all([
      (prisma as any).user.findMany({
        where,
        orderBy: { [orderKey]: orderDir as any },
        select: { id: true, name: true, email: true, active: true, role: true, ciudad: true, porcentaje: true, cedula: true, phone: true, specialty: true, address: true },
        skip: skipN,
        take: takeN
      }),
      prisma.user.count({ where })
    ]);

    const abogadoIds = users.filter((u: any) => u.role === 'ABOGADO').map((u: any) => u.id);
    const caseCountsByAbogado: Record<string, { activos: number; cerrados: number; archivados: number }> = {};
    if (abogadoIds.length > 0) {
      const [countsActivos, countsCerrados, countsArchivados] = await Promise.all([
        (prisma as any).legalCase.groupBy({
          by: ['abogadoId'],
          where: { abogadoId: { in: abogadoIds }, isActive: true, NOT: { status: { in: ['CERRADO', 'ARCHIVADO'] } } },
          _count: { _all: true }
        }),
        (prisma as any).legalCase.groupBy({
          by: ['abogadoId'],
          where: { abogadoId: { in: abogadoIds }, status: 'CERRADO' },
          _count: { _all: true }
        }),
        (prisma as any).legalCase.groupBy({
          by: ['abogadoId'],
          where: { abogadoId: { in: abogadoIds }, status: 'ARCHIVADO' },
          _count: { _all: true }
        })
      ]);
      for (const id of abogadoIds) caseCountsByAbogado[id] = { activos: 0, cerrados: 0, archivados: 0 };
      for (const r of countsActivos) caseCountsByAbogado[r.abogadoId].activos = r._count._all;
      for (const r of countsCerrados) caseCountsByAbogado[r.abogadoId].cerrados = r._count._all;
      for (const r of countsArchivados) caseCountsByAbogado[r.abogadoId].archivados = r._count._all;
    }
    const usersWithCounts = users.map((u: any) => u.role === 'ABOGADO'
      ? { ...u, caseCounts: caseCountsByAbogado[u.id] || { activos: 0, cerrados: 0, archivados: 0 } }
      : u);

    return res.status(200).json({ users: usersWithCounts, total, skip: skipN, take: takeN });
  }

  // POST — crear afiliado (solo ADMIN)
  if (req.method === 'POST') {
    const { name, email, password, ciudad, phone, cedula, porcentaje, specialty, address } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    // Validar especialidad allowlist (null permitido)
    const normSpecialty = normalizeSpecialty(specialty);
    if (normSpecialty !== null && !ALLOWED_SPECIALTIES.has(normSpecialty)) return res.status(400).json({ error: SPECIALTY_ERROR });
    // Validar porcentaje 0–100 (null permitido)
    let pct: number | null = null;
    if (typeof porcentaje !== 'undefined' && porcentaje !== null && porcentaje !== '') {
      const n = Number(porcentaje);
      if (Number.isNaN(n)) return res.status(400).json({ error: 'Porcentaje inválido' });
      if (n < 0 || n > 100) return res.status(400).json({ error: 'Porcentaje debe estar entre 0 y 100' });
      pct = n;
    }
    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await (prisma as any).user.create({
      data: {
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        passwordHash,
        role: 'ABOGADO',
        active: true,
        phone: phone ? String(phone).trim() : null,
        ciudad: ciudad ? String(ciudad).trim() : null,
        cedula: cedula ? String(cedula).trim() : null,
        porcentaje: pct,
        specialty: normSpecialty,
        address: address ? String(address).trim() : null,
      },
    });
    return res.status(201).json({ ok: true, id: user.id });
  }

  if (req.method === 'PUT') {
    const { id, active } = req.body || {};
    if (!id || typeof active !== 'boolean') return res.status(400).json({ error: 'Datos inválidos' });
    if (id === auth.uid && active === false) {
      return res.status(409).json({ error: 'No puedes desactivar tu propio usuario' });
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.role === 'ADMIN' && active === false) {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true, NOT: { id } } });
      if (adminCount === 0) {
        return res.status(409).json({ error: 'No puedes desactivar al último ADMIN' });
      }
    }
    await prisma.user.update({ where: { id }, data: { active } });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { id, role, active, name, ciudad, porcentaje, cedula, specialty, address, phone } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const data: any = {};

    // Actualizar nombre
    if (typeof name !== 'undefined') {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'Nombre no puede estar vacío' });
      data.name = trimmed;
    }
    if (typeof ciudad !== 'undefined') data.ciudad = ciudad ? String(ciudad).trim() : null;
    if (typeof cedula !== 'undefined') data.cedula = cedula ? String(cedula).trim() : null;
    if (typeof address !== 'undefined') data.address = address ? String(address).trim() : null;
    if (typeof phone !== 'undefined') data.phone = phone ? String(phone).trim() : null;
    if (typeof specialty !== 'undefined') {
      const norm = normalizeSpecialty(specialty);
      if (norm !== null && !ALLOWED_SPECIALTIES.has(norm)) return res.status(400).json({ error: SPECIALTY_ERROR });
      data.specialty = norm;
    }

    // Validar y setear porcentaje 0–100 (null permitido)
    if (typeof porcentaje !== 'undefined') {
      if (porcentaje === null || porcentaje === '') {
        data.porcentaje = null;
      } else {
        const n = Number(porcentaje);
        if (Number.isNaN(n)) return res.status(400).json({ error: 'Porcentaje inválido' });
        if (n < 0 || n > 100) return res.status(400).json({ error: 'Porcentaje debe estar entre 0 y 100' });
        data.porcentaje = n;
      }
    }

    if (typeof role !== 'undefined') {
      if (role !== 'ADMIN' && role !== 'ABOGADO') return res.status(400).json({ error: 'Rol inválido' });
      data.role = role;
    }
    if (typeof active !== 'undefined') {
      if (typeof active !== 'boolean') return res.status(400).json({ error: 'Flag activo inválido' });
      data.active = active;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Sin cambios' });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (id === auth.uid) {
      if (typeof data.active === 'boolean' && data.active === false) {
        return res.status(409).json({ error: 'No puedes desactivarte a ti mismo' });
      }
      if (typeof data.role !== 'undefined' && data.role !== 'ADMIN') {
        return res.status(409).json({ error: 'No puedes degradarte a ti mismo' });
      }
    }
    const becomesNonAdmin = (typeof data.role !== 'undefined' && data.role !== 'ADMIN') || (typeof data.active === 'boolean' && data.active === false);
    if (target.role === 'ADMIN' && becomesNonAdmin) {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true, NOT: { id } } });
      if (adminCount === 0) {
        return res.status(409).json({ error: 'No puedes dejar el sistema sin ADMIN' });
      }
    }
    await prisma.user.update({ where: { id }, data });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}