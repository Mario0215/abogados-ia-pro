import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getAuthFromCookies } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || (auth.role !== 'ABOGADO' && auth.role !== 'ADMIN')) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope.toUpperCase() : undefined; // 'PERSONAL'|'SISTEMA'
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined; // submatter
    if (id) {
      const d = await prisma.document.findUnique({ where: { id } });
      if (!d || d.jurisdiccion !== 'FORMATO') return res.status(404).json({ error: 'No encontrado' });
      let owner: string | null = null;
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ ownerUserId: string | null }>>(
          `SELECT "ownerUserId" FROM "Document" WHERE "id" = $1`,
          String(id)
        );
        if (!rows?.length) return res.status(404).json({ error: 'No encontrado' });
        owner = rows?.[0]?.ownerUserId ?? null;
      } catch {
        return res.status(500).json({ error: 'No se pudo verificar la propiedad de la plantilla' });
      }
      const isPersonal = owner !== null;
      if (isPersonal && auth.role !== 'ADMIN' && owner !== auth.uid) {
        return res.status(403).json({ error: 'Sin permisos para ver esta plantilla' });
      }
      return res.status(200).json({
        template: {
          id: d.id,
          title: d.title,
          content: d.content,
          matter: d.matter,
          submatter: d.submatter || null,
          scope: isPersonal ? 'PERSONAL' : 'SISTEMA',
          active: d.active
        }
      });
    }
    if (scope === 'PERSONAL') {
      try {
        const docs = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; matter: string; submatter: string | null }>>(
          `SELECT "id","title","matter","submatter" FROM "Document" WHERE "active" = true AND "jurisdiccion" = 'FORMATO' AND "ownerUserId" = $1 ${tipo ? 'AND "submatter" = $2' : ''} ORDER BY "title" ASC`,
          ...(tipo ? [auth.uid, String(tipo)] : [auth.uid])
        );
        return res.status(200).json({ templates: docs.map(d => ({ ...d, scope: 'PERSONAL' })) });
      } catch {
        return res.status(200).json({ templates: [] });
      }
    }
    if (scope === 'SISTEMA') {
      try {
        const docs = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; matter: string; submatter: string | null }>>(
          `SELECT "id","title","matter","submatter" FROM "Document" WHERE "active" = true AND "jurisdiccion" = 'FORMATO' AND "ownerUserId" IS NULL ${tipo ? 'AND "submatter" = $1' : ''} ORDER BY "title" ASC`,
          ...(tipo ? [String(tipo)] : [])
        );
        return res.status(200).json({ templates: docs.map(d => ({ ...d, scope: 'SISTEMA' })) });
      } catch {
        return res.status(200).json({ templates: [] });
      }
    }
    const docs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      matter: string;
      submatter: string | null;
      ownerUserId: string | null;
    }>>(
      `SELECT "id","title","matter","submatter","ownerUserId"
       FROM "Document"
       WHERE "active" = true
         AND "jurisdiccion" = 'FORMATO'
         AND ($1 = 'ADMIN' OR "ownerUserId" IS NULL OR "ownerUserId" = $2)
         ${tipo ? 'AND "submatter" = $3' : ''}
       ORDER BY "title" ASC`,
      ...(tipo ? [auth.role, auth.uid, String(tipo)] : [auth.role, auth.uid])
    );
    return res.status(200).json({
      templates: docs.map(({ ownerUserId, ...d }) => ({
        ...d,
        scope: ownerUserId !== null ? 'PERSONAL' : 'SISTEMA'
      }))
    });
  }

  if (req.method === 'POST') {
    const { id, title, content, matter, submatter } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'Título y contenido requeridos' });
    if (id) {
      const before = await prisma.document.findUnique({ where: { id: String(id) } });
      if (!before || before.jurisdiccion !== 'FORMATO') return res.status(404).json({ error: 'No encontrado' });
      let owner: string | null = null;
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ ownerUserId: string | null }>>(
          `SELECT "ownerUserId" FROM "Document" WHERE "id" = $1`,
          String(id)
        );
        owner = rows?.[0]?.ownerUserId ?? null;
      } catch {}
      if (owner && owner !== auth.uid) return res.status(403).json({ error: 'Sin permisos para editar' });
      if (!owner && auth.role !== 'ADMIN') return res.status(403).json({ error: 'Solo ADMIN puede editar plantillas del sistema' });
      const d = await prisma.document.update({
        where: { id: String(id) },
        data: {
          title: String(title),
          content: String(content),
          matter: matter ? String(matter) : before.matter,
          submatter: submatter ? String(submatter) : before.submatter
        }
      });
      return res.status(200).json({ id: d.id });
    }
    const d = await prisma.document.create({
      data: {
        title: String(title),
        matter: String(matter || 'CIVIL'),
        jurisdiccion: 'FORMATO',
        active: true,
        content: String(content),
        submatter: submatter ? String(submatter) : null,
        ownerUserId: auth.uid,
      }
    });
    return res.status(201).json({ id: d.id });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID requerido' });
    const before = await prisma.document.findUnique({ where: { id } });
    if (!before || before.jurisdiccion !== 'FORMATO') return res.status(404).json({ error: 'No encontrado' });
    let owner: string | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ ownerUserId: string | null }>>(
        `SELECT "ownerUserId" FROM "Document" WHERE "id" = $1`,
        String(id)
      );
      owner = rows?.[0]?.ownerUserId ?? null;
    } catch {}
    if (owner && owner !== auth.uid) return res.status(403).json({ error: 'Sin permisos para eliminar' });
    if (!owner && auth.role !== 'ADMIN') return res.status(403).json({ error: 'Solo ADMIN puede eliminar plantillas del sistema' });
    await prisma.document.update({ where: { id }, data: { active: false } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
