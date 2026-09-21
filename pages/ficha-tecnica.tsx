import Head from 'next/head';
import Link from 'next/link';
import Logo from '../components/Logo';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';

export default function FichaTecnica() {
  const router = useRouter();
  function exportar() {
    const a = document.createElement('a');
    a.href = '/api/export/ficha-tecnica';
    a.download = 'Ficha_Tecnica_Abogados_IA_V2.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  return (
    <>
      <Head><title>Ficha Técnica – Abogados IA V2</title></Head>
      <div className="container" style={{ maxWidth: 1000 }}>
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button" onClick={exportar}>Exportar PDF</button>
            <Link href="/dashboard" className="button">Volver</Link>
          </div>
        </header>

        <div className="card">
          <h1 className="title">Ficha Técnica del Proyecto</h1>
          <p className="muted">Sistema de gestión legal asistido por IA para abogados en México.</p>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Resumen</h2>
          <ul>
            <li>Nombre del proyecto: Abogados IA V2</li>
            <li>Objetivo: Centralizar gestión de casos, consultas legales y generación de documentos.</li>
            <li>Usuarios: Abogados (ABOGADO) y Administradores (ADMIN).</li>
            <li>Autenticación: JWT en cookie httpOnly; roles y permisos por servidor.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Arquitectura y Tecnologías</h2>
          <ul>
            <li>Framework Web: Next.js 14.2.5 (Pages Router).</li>
            <li>Frontend: React 18 con TypeScript 5.6.3, ESLint core-web-vitals.</li>
            <li>Backend: API Routes de Next.js.</li>
            <li>BD: Prisma 5.16.1 con PostgreSQL (DATABASE_URL para producción).</li>
            <li>Autenticación: jsonwebtoken, cookie, bcryptjs.</li>
            <li>Subidas de archivos: formidable.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Módulos Principales</h2>
          <ul>
            <li>Panel del Abogado: Chat legal, consultas, acceso a Demandas y Mis Casos.</li>
            <li>Mis Casos: Listado, detalle, adjuntos, eventos y chat relacionado.</li>
            <li>Demandas: Carga por expediente, materia y rol desde “Mis Casos”, selector de formatos y generación de documento.</li>
            <li>Admin: Gestión de usuarios, estados, documentos/leyes y materias activas.</li>
            <li>Catálogo: Materias y disponibilidad según documentos cargados; formatos por materia.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Flujo de Autenticación</h2>
          <ul>
            <li>Inicio de sesión: POST /api/auth/login, emite cookie httpOnly con JWT.</li>
            <li>Registro: POST /api/auth/register; sólo un ADMIN puede crear cuentas de abogados.</li>
            <li>Protección de páginas: getServerSideProps valida cookie y rol.</li>
            <li>Logout: Link a /api/auth/logout limpia la cookie.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Roles y Permisos</h2>
          <ul>
            <li>ADMIN: Admin panel, carga y activación de documentos, materias y estados, gestión de usuarios.</li>
            <li>ABOGADO: Dashboard, Mis Casos, Demandas, Clientes, Consultas, descargas y subidas de adjuntos.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Base de Datos (Prisma)</h2>
          <ul>
            <li>User: perfil, rol, estado, relaciones con casos, clientes y chats.</li>
            <li>State: catálogo de estados; relación con documentos y consultas.</li>
            <li>Document: leyes y formatos por materia/jurisdicción; archivo persistido.</li>
            <li>LegalCase: casos con expediente, materia, cliente, adjuntos y eventos.</li>
            <li>Client: clientes por abogado.</li>
            <li>ChatLog: historial de conversaciones legales.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">API Principal</h2>
          <ul>
            <li>Autenticación: /api/auth/login, /api/auth/register.</li>
            <li>Admin: /api/admin/users, /api/admin/documents, /api/admin/matters.</li>
            <li>Catálogo: /api/catalog/states, /api/catalog/matters, /api/catalog/matters-availability, /api/catalog/formats.</li>
            <li>Casos: /api/cases (POST/PUT/GET por id), /api/cases/upload, /api/cases/download, /api/cases/document.</li>
            <li>Clientes: /api/clients.</li>
            <li>Chats: /api/chat/[id].</li>
            <li>Consultas: /api/consultations.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Páginas Clave</h2>
          <ul>
            <li>Dashboard: panel del abogado.</li>
            <li>Mis Casos: listado y detalle de casos.</li>
            <li>Demandas: generación y documento de demanda.</li>
            <li>Admin: administración de usuarios, estados y documentos.</li>
            <li>Login y Registro.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Build y Despliegue</h2>
          <ul>
            <li>Scripts: dev, build, start, lint, typecheck, prisma:*</li>
            <li>Entorno: .env para secretos (JWT, rutas de almacenamiento).</li>
            <li>Persistencia de archivos: carpeta “uploads” (excluida de Git).</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Seguridad y Cumplimiento</h2>
          <ul>
            <li>JWT en cookie httpOnly (sameSite=lax, secure=false en dev).</li>
            <li>Control de acceso por rol en API y SSR.</li>
            <li>Validación de entradas y manejo de errores en API.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Limitaciones y Supuestos</h2>
          <ul>
            <li>BD PostgreSQL en producción; ajustar migraciones antes del despliegue.</li>
            <li>Parámetros de IA y plantillas sujetas a personalización futura.</li>
            <li>Exportación de documento desde vista de demanda; formatos administrativos cargados por Admin.</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="title">Instrucciones de Exportación a PDF</h2>
          <ul>
            <li>Abre esta página en el navegador.</li>
            <li>Haz clic en “Exportar PDF”.</li>
            <li>Se descargará el archivo “Ficha_Tecnica_Abogados_IA_V2.pdf”.</li>
            <li>Opcional: oculta encabezados/pies de página del navegador para un resultado limpio.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
