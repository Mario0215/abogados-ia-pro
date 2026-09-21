import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getClienteFromCookies } from '../../../lib/cliente-auth';
import { ABOGADO_ADMIN_ID } from '../../../lib/cliente-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { tipoServicio, datosPersonales, respuestas, cotizacion } = req.body || {};

  if (!tipoServicio || !datosPersonales?.nombre || !datosPersonales?.ciudad) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Obtener el ID del administrador propietario de los casos del portal
  let adminId = ABOGADO_ADMIN_ID;
  if (!adminId) {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', active: true },
      select: { id: true },
    });
    if (!admin) return res.status(500).json({ error: 'No hay administrador configurado' });
    adminId = admin.id;
  }

  // Verificar que el usuario del portal existe
  const portalUser = await (prisma as any).clientPortalUser.findUnique({
    where: { id: auth.uid },
    include: { client: true },
  });
  if (!portalUser) return res.status(401).json({ error: 'Usuario no encontrado' });

  // Calcular cotización en el servidor (verificación)
  const svc: any = await (prisma as any).servicioConfig.findUnique({ where: { servicioId: String(tipoServicio) } });
  if (!svc || svc.activo === false) return res.status(400).json({ error: 'Tipo de servicio no válido' });
  const modsArr: any[] = await (prisma as any).precioModificador.findMany();
  const mods = new Map<string, number>(modsArr.map((m: any) => [String(m.key), Number(m.valor)]));
  let precioCalculado = Number(svc.precioBase) || 0;
  if (tipoServicio === 'DIVORCIO_CONTENCIOSO') precioCalculado += mods.get('EXTRA_CONTENCIOSO') || 0;
  if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio)) {
    if (respuestas?.tieneHijos === 'si') {
      const n = Math.max(parseInt(respuestas?.numHijos || '1'), 1);
      precioCalculado += n * (mods.get('EXTRA_HIJO') || 0);
    }
    if (respuestas?.bienesComun === 'si') precioCalculado += mods.get('EXTRA_BIENES') || 0;
  }
  if (tipoServicio === 'PENSION_ALIMENTICIA') {
    const n = Math.max(parseInt(respuestas?.numHijos || '0'), 0);
    if (n > 0) precioCalculado += n * (mods.get('EXTRA_HIJO') || 0);
  }

  const precioFinal = precioCalculado;

  // Extraer contraparte de las respuestas según el tipo de caso
  const contraparteMap: Record<string, string> = {
    DIVORCIO_MUTUO: 'nombreConyuge',
    DIVORCIO_CONTENCIOSO: 'nombreConyuge',
    PENSION_ALIMENTICIA: 'nombreObligado',
    NULIDAD_CONTRATO: 'nombreContraparte',
    DANOS_PERJUICIOS: 'nombreResponsable',
    SUCESION: 'nombreFallecido',
  };
  const cpKey = contraparteMap[tipoServicio];
  const counterparty = (cpKey && respuestas?.[cpKey]) || '';

  // Crear o reutilizar el registro Client vinculado al usuario del portal
  let clientId = portalUser.clientId as string | null;

  if (!clientId) {
    const newClient = await (prisma as any).client.create({
      data: {
        userId: adminId,
        name: String(datosPersonales.nombre).trim(),
        phone: datosPersonales.telefono ? String(datosPersonales.telefono).trim() : null,
        email: datosPersonales.correo ? String(datosPersonales.correo).trim() : null,
        address: datosPersonales.domicilio ? String(datosPersonales.domicilio).trim() : null,
        ciudad: String(datosPersonales.ciudad).trim(),
      },
    });
    clientId = newClient.id as string;

    // Vincular el client al portal user
    await (prisma as any).clientPortalUser.update({
      where: { id: auth.uid },
      data: { clientId },
    });
  }

  // Generar número de expediente único
  const count = await (prisma as any).legalCase.count();
  const expediente = `CPT-${String(count + 1).padStart(5, '0')}`;

  const templates: Record<string, Array<{ key: string; label: string }>> = {
    DIVORCIO_MUTUO: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del solicitante' },
      { key: 'INE_CONTRAPARTE', label: 'Identificación oficial (INE) de la contraparte' },
      { key: 'ACTA_MATRIMONIO', label: 'Acta de matrimonio' },
      { key: 'ACTA_NAC_HIJOS', label: 'Actas de nacimiento de hijos (si aplica)' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
    ],
    DIVORCIO_CONTENCIOSO: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del actor' },
      { key: 'ACTA_MATRIMONIO', label: 'Acta de matrimonio' },
      { key: 'ACTA_NAC_HIJOS', label: 'Actas de nacimiento de hijos (si aplica)' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
      { key: 'PRUEBAS', label: 'Documentos/pruebas relacionadas (si aplica)' },
    ],
    PENSION_ALIMENTICIA: [
      { key: 'INE_ACTOR', label: 'Identificación oficial (INE) del promovente' },
      { key: 'ACTA_NAC_MENORES', label: 'Actas de nacimiento de los menores' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
      { key: 'DATOS_DEMANDADO', label: 'Datos del obligado (si los tienes)' },
    ],
    SUCESION: [
      { key: 'INE_PROMOVENTE', label: 'Identificación oficial (INE) del promovente' },
      { key: 'ACTA_DEFUNCION', label: 'Acta de defunción' },
      { key: 'ACTA_NACIMIENTO', label: 'Acta de nacimiento del promovente' },
      { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
    ],
  };
  const template = templates[tipoServicio] || [
    { key: 'INE', label: 'Identificación oficial (INE)' },
    { key: 'COMPROBANTE_DOM', label: 'Comprobante de domicilio' },
  ];
  const docRequests = template.map((d, i) => ({
    id: `tpl_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
    key: d.key,
    label: d.label,
    status: 'PENDIENTE',
    createdAt: new Date().toISOString(),
  }));

  // Crear el expediente
  const legalCase = await (prisma as any).legalCase.create({
    data: {
      userId: adminId,
      clientId,
      abogadoId: null,
      type: 'CREAR',
      matter: 'CIVIL',
      intent: tipoServicio,
      expediente,
      counterparty,
      ciudad: String(datosPersonales.ciudad).trim(),
      estadoAsignacion: 'PENDIENTE',
      notes: JSON.stringify({ tipoServicio, datosPersonales, respuestas, docRequests }),
      precioCliente: precioFinal,
      honorarioAbogado: null,
      status: 'BORRADOR',
      isActive: true,
    },
  });

  return res.status(201).json({ caseId: legalCase.id, expediente });
}
