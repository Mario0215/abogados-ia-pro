import type { NextApiRequest, NextApiResponse } from 'next';
import PDFDocument from 'pdfkit';
import { bucket } from '../../../lib/gcs';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Ficha_Tecnica_Abogados_IA_V2.pdf"');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(Buffer.from(c)));
  doc.pipe(res);

  doc.fontSize(20).text('Ficha Técnica – Abogados IA V2', { align: 'left' });
  doc.moveDown();
  doc.fontSize(12).fillColor('black').text('Sistema de gestión legal asistido por IA para abogados en México.');

  doc.moveDown().fontSize(14).text('Resumen');
  doc.fontSize(12).text('- Nombre del proyecto: Abogados IA V2');
  doc.text('- Objetivo: Centralizar gestión de casos, consultas legales y generación de documentos.');
  doc.text('- Usuarios: Abogados (ABOGADO) y Administradores (ADMIN).');
  doc.text('- Autenticación: JWT en cookie httpOnly; roles y permisos por servidor.');

  doc.moveDown().fontSize(14).text('Arquitectura y Tecnologías');
  doc.fontSize(12).text('- Next.js 14.2.5 (Pages Router).');
  doc.text('- React 18 con TypeScript 5.6.3.');
  doc.text('- API Routes de Next.js.');
  doc.text('- Prisma 5.16.1 con PostgreSQL (DATABASE_URL).');
  doc.text('- Autenticación con jsonwebtoken, cookie, bcryptjs.');
  doc.text('- Subidas de archivos con formidable.');

  doc.moveDown().fontSize(14).text('Módulos Principales');
  doc.fontSize(12).text('- Panel del Abogado: chat legal, consultas, acceso a Demandas y Mis Casos.');
  doc.text('- Mis Casos: listado, detalle, adjuntos, eventos y chat relacionado.');
  doc.text('- Demandas: generación y documento por expediente, materia y rol.');
  doc.text('- Admin: usuarios, estados, documentos/leyes y materias activas.');
  doc.text('- Catálogo: materias y disponibilidad por documentos cargados.');

  doc.moveDown().fontSize(14).text('Flujo de Autenticación');
  doc.fontSize(12).text('- Inicio: POST /api/auth/login, emite cookie httpOnly con JWT.');
  doc.text('- Registro: POST /api/auth/register; sólo un ADMIN puede crear cuentas de abogados.');
  doc.text('- Protección SSR: getServerSideProps valida cookie y rol.');
  doc.text('- Logout: /api/auth/logout limpia la cookie.');

  doc.moveDown().fontSize(14).text('Roles y Permisos');
  doc.fontSize(12).text('- ADMIN: administración de usuarios, estados, documentos y materias.');
  doc.text('- ABOGADO: Dashboard, Mis Casos, Demandas, Clientes, Consultas, adjuntos.');

  doc.moveDown().fontSize(14).text('Base de Datos (Prisma)');
  doc.fontSize(12).text('- User, State, Document, LegalCase, Client, ChatLog, CaseAttachment, CaseEvent.');
  doc.text('- Índices clave: único por usuario+expediente para LegalCase.');

  doc.moveDown().fontSize(14).text('API Principal');
  doc.fontSize(12).text('- Autenticación: /api/auth/login, /api/auth/register.');
  doc.text('- Admin: /api/admin/users, /api/admin/documents, /api/admin/matters.');
  doc.text('- Catálogo: /api/catalog/states, /api/catalog/matters, /api/catalog/matters-availability, /api/catalog/formats.');
  doc.text('- Casos: /api/cases (POST/PUT/GET por id), /api/cases/upload, /api/cases/download, /api/cases/document.');
  doc.text('- Clientes: /api/clients.');
  doc.text('- Chats: /api/chat/[id].');
  doc.text('- Consultas: /api/consultations.');

  doc.moveDown().fontSize(14).text('Páginas Clave');
  doc.fontSize(12).text('- Dashboard, Mis Casos, Demandas, Admin, Login y Registro.');

  doc.moveDown().fontSize(14).text('Build y Despliegue');
  doc.fontSize(12).text('- Scripts: dev, build, start, lint, typecheck, prisma:*.');
  doc.text('- Entorno: variables en .env (JWT, almacenamiento, DATABASE_URL).');
  doc.text('- Dockerfile para Cloud Run; PORT=8080; conexión a Cloud SQL.');
  doc.text('- Caché HTTP en endpoints de listas para rendimiento.');

  doc.moveDown().fontSize(14).text('Diseño UI');
  doc.fontSize(12).text('- Botones azul marino metálico con texto blanco.');
  doc.text('- Título superior derecho: Abogados IA; subtexto CYMNOVA A.C.');
  doc.text('- Superior izquierdo: texto rojo “ABOGADOS IA” y “CYMNOVA A.C.”.');
  doc.text('- Pie: “Numari Inc. · Todos los Derechos Reservados”.');

  doc.moveDown().fontSize(14).text('Seguridad y Cumplimiento');
  doc.fontSize(12).text('- Cookie httpOnly, sameSite=lax.');
  doc.text('- Control de acceso por rol en API y SSR.');
  doc.text('- Validación y manejo de errores en API.');

  doc.moveDown().fontSize(14).text('Limitaciones y Supuestos');
  doc.fontSize(12).text('- Almacenamiento de adjuntos debe migrar a GCS en producción.');
  doc.text('- Parámetros de IA y plantillas son personalizables.');

  doc.end();
  doc.on('end', async () => {
    if (bucket) {
      const key = `exports/ficha_tecnica_${Date.now()}.pdf`;
      await bucket.file(key).save(Buffer.concat(chunks), { contentType: 'application/pdf' });
    }
  });
}
