# Abogados IA PRO

## Productos Abogados IA

- **Abogados IA V2** es el SaaS abierto para abogados y despachos externos que operan de forma independiente.
- **Abogados IA PRO** es la plataforma propia de Abogados IA para captar clientes y operar sus asuntos mediante abogados comisionistas autorizados por ADMIN. El cliente conserva acceso a su portal.

La documentación técnica que sigue corresponde a la implementación actual de PRO.

[![Build Status](https://github.com/OWNER/REPO/actions/workflows/build.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/build.yml)
[![RAG Regression Status](https://github.com/OWNER/REPO/actions/workflows/rag-regression.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/rag-regression.yml)

## Arquitectura RAG

- Endpoints:
  - `POST /api/rag/answer`: orquesta flujo exacto y mixto.
  - `POST /api/rag/search`: búsqueda vectorial segmentada.
- Requisitos:
  - `OPENAI_API_KEY` configurada.
  - Base de datos PostgreSQL con `pgvector` activo.
  - Columna `Document.embedding` con tipo `vector(1536)`.
  - Segmentación estricta por corpus mediante `sourceType`:
    - CPC = Código de Procedimientos Civiles (Procesal/Adjetivo).
    - CC  = Código Civil (Sustantivo).
  - Filtros: `matter=CIVIL`, `submatter`, `jurisdiccion=ESTATAL`.

### Flujo “Artículo N” (numérico puro)

- Detección con regex anclado: `^\s*art(í|i)?culo\s*(\d+)\s*$`.
- Si coincide:
  - No usa embeddings ni LLM.
  - Consulta directa por título exacto o `Artículo N %` con SQL anclado.
  - Devuelve el contenido del artículo sin redacción.
  - Flags de respuesta: `usedVector=false`, `exactPartial=false`, `fallbackWide=false`.
  - Mensaje si no existe: “Artículo no encontrado en este ordenamiento.”
- Blindaje contra contaminación numérica: diferencia 60 ≠ 605.

### Flujo Mixto (no numérico puro)

- Prioriza “exact match parcial” si la consulta contiene “artículo N”.
- Complementa con búsqueda vectorial filtrada por corpus.
- Redacta vía LLM usando exclusivamente el contexto filtrado.
- Orden de fuentes: si hay artículo citado, aparece primero en `sources[]`.
- Flags de respuesta: `usedVector=true`, `exactPartial=true|false`, `fallbackWide=false`.
- Sin cruce entre CPC y CC.

## Pruebas De Regresión

- Script: `scripts/ragRegression.js`
- Ejecutar local:
  - Arranca servidor: `npm run dev`.
  - Usuario de pruebas (una vez): `node scripts/seedTestUser.js`.
  - Correr batería: `npm run test:rag:regression`.
- Casos cubiertos:
  - Numéricos puros: CPC 60, CC 287, Art. 1 en CPC/CC, inexistentes.
  - Mixtas con artículo: CPC 60/plazos, CC 322.
  - Temáticas puras: requisitos/plazos (CPC), efectos del divorcio/matrimonio (CC).
  - Cruce CPC/CC: “Divorcio” (CPC), “Demanda” (CC).
  - Estabilidad semántica larga (CPC): verifica citas presentes en `sources[]`.
- Validaciones automáticas por caso:
  - `sourceType` homogéneo.
  - `exactPartial` correcto.
  - `fallbackWide=false`.
  - Artículo citado primero en `sources[]` cuando aplica.
  - Sin números cercanos (60 vs 605).
  - En respuestas largas, los “Artículo N” citados existen en `sources[]`.
  - Si algo falla → salida con código 1.

## Integración Continua (CI) Obligatoria

- Workflow: `.github/workflows/rag-regression.yml`.
- Variables en Secrets del repositorio/entorno:
  - `RAG_BASE_URL`: URL del entorno donde corre la app.
  - `OPENAI_API_KEY`
  - `JWT_SECRET`
- Regla: si `npm run test:rag:regression` falla → CI falla → no hay deploy.

## Hooks Configurables (No Invasivos)

- Hook opcional pre-push: `.githooks/pre-push`.
  - Si `BASE_URL` no es alcanzable localmente, omite la ejecución (se confía en CI).
  - Para habilitar:
    - `npm run hooks:enable`
  - Para deshabilitar:
    - `npm run hooks:disable`

## Desarrollo

- Scripts útiles:
  - `npm run dev` — servidor local.
  - `npm run typecheck` — TypeScript sin emitir.
  - `npm run lint` — ESLint.
  - `npm run test:rag:regression` — regresión RAG.
  - `npm run hooks:enable` / `npm run hooks:disable` — gestionar hooks.

## Configuración y despliegue

- Copia `.env.example` a `.env.local` para desarrollo y configura, como mínimo, `DATABASE_URL`, `JWT_SECRET` y `OPENAI_API_KEY`.
- Genera un `JWT_SECRET` único y largo para cada entorno. La aplicación no usa un secreto conocido en producción.
- Antes de desplegar esta versión, ejecuta `prisma/preflight/20260914_reconcile_runtime_schema.sql` en staging y resuelve cualquier fila o error que produzca. Después aplica `npm run prisma:migrate:deploy`. La migración `20260914000000_reconcile_runtime_schema` alinea la base de datos con los modelos del portal, pagos y expedientes; haz respaldo y pruébala primero en staging.
- Después de instalar dependencias, valida con `npm run lint`, `npm run typecheck` y `npm run build`.
- La creación de abogados requiere una sesión `ADMIN`. Aprovisiona el primer administrador mediante un mecanismo controlado de infraestructura; el endpoint de recuperación de cuentas permanece deshabilitado salvo que `RESET_ACCOUNTS_ENABLED=true` y se use un `POST` con `x-reset-token`.
- El portal no enlaza una cuenta nueva con expedientes existentes sólo por correo de forma predeterminada. Activa `PORTAL_AUTO_LINK_EXISTING_CLIENTS=true` únicamente si cuentas con una verificación de identidad externa.
