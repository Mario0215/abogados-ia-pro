# Fase 4 — Cobertura, Especialidad y Capacidad Abogado Comisionista

## Repository Research (Diagnóstico)

### Modelo User actual (schema.prisma L11-L34)
| Campo | Tipo | Semántica actual |
|---|---|---|
| `id` | String | PK |
| `name` | String | Nombre completo |
| `phone` | String? | Teléfono |
| `email` | String | Unique login |
| `address` | String? | Domicilio completo (texto libre) |
| `specialty` | String? | **Especialidad principal**, allowlist `{CIVIL, FAMILIAR, LABORAL}` — **ya existe** |
| `role` | String | ABOGADO / ADMIN |
| `active` | Boolean | **Cuenta habilitada/deshabilitada** — semántica actual NO es disponibilidad asignación |
| `ciudad` | String? | **Ubicación base** del abogado |
| `porcentaje` | Float? | Comisión % (0–100) |
| `cedula` | String? | Cédula profesional |
| `casosAsignados` | LegalCase[] | Relación `CasosAsignados` con `LegalCase.abogadoId` |

### LegalCase.abogadoId — Conteos
- Activos asignados = `WHERE abogadoId, isActive=true, status ∉ {CERRADO,ARCHIVADO}` → **calculable dinámicamente**
- Cerrados = `status=CERRADO` → calculable
- Archivados = `status=ARCHIVADO` → calculable

### Infraestructura UI existente
1. **Sección Abogados Comisionistas**: `pages/admin/panel-demo.tsx` L932-L982
   - Tabla actual cols: Nombre · Ciudad · Correo · Cédula · Comisión % · Estado · Acciones
   - Select especialidad ya existe en modal editar/nuevo: CIVIL/FAMILIAR/LABORAL (L1002-L1010 y L1045-L1050)
2. **Selector asignación**: `/api/admin/casos.ts` L82-L86 + `panel-demo.tsx` L768-L771
   - Query: `where role=ABOGADO, active=true` → inactivos ya excluídos ✅
   - Select actual: `{nombre} · {ciudad} ({especialidad})`
3. **API users CRUD**: `/api/admin/users.ts` — GET ya retorna `specialty, ciudad, porcentaje, address`; POST/PATCH ya valida allowlist specialty (L6, L54-L56, L119-L123)

---

## Hallazgos: Bloques 1–4 (SIN Prisma vs REQUIERE Prisma)

### Bloque 1 — Especialidad (Cumple SIN Prisma)
✅ **Reutilizable:** `User.specialty` String + allowlist `{CIVIL,FAMILIAR,LABORAL}` ya existe en modelo, API y UI.  
✅ **Decisión:** Para F4 operamos con **1 especialidad principal por abogado** (evita Prisma).  
⚠️ **Punto de consulta a MESA:** Si en el futuro es INDISPENSABLE multi-especialidad por abogado, requerirá Prisma: `User.specialty: String[]` o tabla `AbogadoEspecialidad` M2M. **En este plan F4: NO Prisma, NO multi-especialidad.**

### Bloque 2 — Cobertura Geográfica (REQUIERE Prisma para multi-municipio)
⚠️ **Bloqueo real:** No existe campo en User para representar **lista de municipios donde atiende**.
- `ciudad` = ubicación base; NO es cobertura.
- `address` = domicilio; semántica distinta (prohibido reutilizar).

**Alternativa SIN Prisma adoptada en este plan (F4):**
- Mostrar cobertura = **"Ciudad base" (`User.ciudad`)** como dato reutilizable existente.
- En UI tabla/selector añadir indicador visual: "Cobertura multi-municipio · Configuración Prisma pendiente".
- Si MESA requiere cobertura multi-municipio AHORA: **detener**. Prisma propuesto: `User.coberturaMunicipios String[] @default([])` + campo editable.

### Bloque 3 — Capacidad Operativa (Cumple SIN Prisma)
✅ **100% calculable dinámicamente** con agregados Prisma `count()` sobre `LegalCase.abogadoId`.
- Casos activos = `WHERE abogadoId=X AND isActive=true AND status NOT IN [CERRADO, ARCHIVADO]`
- Casos cerrados = `WHERE status=CERRADO`
- Casos archivados = `WHERE status=ARCHIVADO`
- **No hay necesidad de persistir contador.**

### Bloque 4 — Disponibilidad (REQUIERE Prisma para flag separado)
⚠️ **Confusión conceptual detectada:** `User.active` = **cuenta habilitada/deshabilitada** (login, permiso general). NO es "disponibilidad para recibir nuevos asuntos" (un abogado con cuenta activa puede estar de vacaciones).

**Alternativa SIN Prisma adoptada en este plan (F4):**
- Heurística de disponibilidad **calculada en UI, NO persistida**:
  - `INACTIVO` (cuenta desactivada) → badge rojo "No disponible"
  - `ACTIVO + 0-2 casos activos` → badge verde "Disponible"
  - `ACTIVO + 3-5 casos activos` → badge amarillo "Capacidad media"
  - `ACTIVO + 6+ casos activos` → badge rojo "Carga alta"
- Si MESA requiere disponibilidad manual sobreescribible por ADMIN o capacidad máxima configurable: **detener**. Prisma propuesto: `User.disponibleAsignacion Boolean @default(true)` + `User.capacidadMaximaCasos Int?`.

---

## Files and Modules (Scope autorizado SIN Prisma)

| Archivo | Cambio esperado |
|---|---|
| `pages/api/admin/users.ts` | Extender GET `/api/admin/users` para inyectar `caseCounts: { activos, cerrados, archivados }` calculados dinámicamente. Mantener POST/PATCH intactos sin specialty multi. |
| `pages/api/admin/casos.ts` | Extender `abogados` del GET con `caseCounts.activos` para enriquecer selector asignación. Mantener filtro active=true. Mantener PATCH intacto. |
| `pages/admin/panel-demo.tsx` | (A) Tabla Abogados Comisionistas: +columna Especialidad, +columna Casos Activos, +columna Disponibilidad (heurística). Type `Afiliado` extendido. (B) Selector asignación: `<option>` añade `N casos activos`. Type `casosAbogados` extendido. |

**NO TOCAR (fuera scope o prohibido):**
- Prisma schema ❌
- LegalCore / Document / RAG / corpus ❌
- Stripe / portal cliente / servicios / comisiones ❌
- `/pages/mis-casos/**`, `/pages/dashboard.tsx`, `/pages/api/cases/**` (F3) ❌
- Fase 5–6 ❌

---

## Implementation Steps (orden de dependencias, SIN Prisma)

### Step 1: Endpoint `/api/admin/users` GET agrega conteos dinámicos
- En `/api/admin/users.ts`, después del `findMany` users ABOGADO (L36-L43), paralelizar `prisma.legalCase.groupBy` o `Promise.all` N counts por userId para calcular `activos/cerrados/archivados` y mergear cada user.
- Retornar en el JSON: `users: [{ ...baseUser, caseCounts: { activos, cerrados, archivados } }]`.
- No tocar POST/PUT/PATCH.

### Step 2: Endpoint `/api/admin/casos.ts` GET agrega conteos a lista `abogados`
- En `/api/admin/casos.ts:L82-L86` findMany abogados, añadir mismo `caseCounts.activos` (mismo patrón Step 1).
- Filtro `active=true` se MANTIENE (Prueba 5: inactivos no aparecen).
- Retornar `abogados: [{ id,name,ciudad,specialty,phone, activosAsignados: n }]`.

### Step 3: Tabla Abogados Comisionistas (panel-demo.tsx sección afiliados)
- Extender type `Afiliado`: `caseCounts?: { activos:number; cerrados:number; archivados:number }`.
- Columnas actuales: Nombre · Ciudad · Correo · Cédula · Comisión % · Estado · Acciones (7 cols).
- **Agregar 2 cols (total 9):**
  1. `Especialidad`: `CIVIL/FAMILIAR/LABORAL` badge acrónimo color (ej: CIVIL=#38bdf8, FAMILIAR=#f472b6, LABORAL=#f97316). Null → `—`.
  2. `Carga / Casos`: chip `{activos} activo(s)` con color por heurística disponibilidad Bloque 4. Tooltip: "Cerrados={cerrados} · Archivados={archivados}".
- Columna `Estado` (ACTIVO/BAJA) permanece (semántica cuenta habilitada).
- loadAfiliados() y `setAfiliados` ya consumen `/api/admin/users?role=ABOGADO` — sin cambios en fetch, solo extend type.

### Step 4: Selector asignación enriquecido (panel-demo.tsx L768-L771)
- Extender type `casosAbogados`: `activosAsignados?: number`.
- Formato `<option>`: **`{a.name} · {a.specialty ?? SIN_ESP} · {a.ciudad ?? S/C} · {a.activosAsignados ?? 0} activos`**
- Ejemplo: "Juan Pérez · FAMILIAR · León · 3 activos"
- NO ranking. NO selección automática. NO algoritmo. ADMIN decide.

### Step 5: Manejo de inactivos (Prueba 5)
- Ya garantizado en `/api/admin/casos.ts:L83` `where:{role:'ABOGADO', active:true}`. Inactivos NUNCA entran al selector.
- En tabla comisionistas, inactivos se ven en color BAJA rojo (ya existe).

### Step 6: Validaciones estáticas
- `npx tsc --noEmit` — sin errores.
- `npx eslint pages/api/admin/users.ts pages/api/admin/casos.ts pages/admin/panel-demo.tsx` — sin errores (warnings `no-console` permitidos).

### Step 7: Pruebas mínimas 1–6 por inspección + Grep
1. Especialidad y ciudad visibles en tabla comisionistas.
2. Conteo activos real por abogado (coherente con query count).
3. CERRADO/ARCHIVADO excluídos de carga activa (grep where NOT IN).
4. Selector asignación: formato `nombre · esp · ciudad · N activos`.
5. ABOGADO `active=false` NO en selector (grep where active=true en casos.ts abogados findMany).
6. Grep sin `caseCount > caseCount` ni lógica de ordenamiento/ranking en selector (probar que NO hay algoritmo).

---

## Dependencies and Considerations
- **Reutilización 100%**: no nuevas rutas, no nuevas tablas, no Prisma, no nuevo state global. Solo se extienden 2 responses API y 2 types/renders en panel-demo.
- **Performance Step 1+2**: conteos por abogado con `Promise.all` + `count()`; con <100 abogados es despreciable. Si >100, migrar a groupBy en Step 1; pero scope actual permite count por user.
- **Falta Prisma advertida en UI (no silenciada)**: en panel-demo.tsx tabla añadir un componente `<small muted>` bajo el título "Abogados Comisionistas" indicando: *"Cobertura multi-municipio, capacidad máxima configurable y disponibilidad manual requieren actualización Prisma pendiente."* (transparencia).
- **Backward compat**: cambios en responses API son **superconjuntos** (campos nuevos); consumidores existentes (loadAfiliados con select manual, panel-demo) no se rompen. No se cambian nombres de campos ni se eliminan.
- **Tipos TypeScript**: los `caseCounts`/`activosAsignados` son propiedades opcionales en types (`?:`) para no romper si response llega sin ellos (defensa).

---

## Validation
- Prueba 1 → inspección DOM tabla comisionistas col Especialidad + Ciudad.
- Prueba 2 → Grep output JSON `/api/admin/users?role=ABOGADO` = `caseCounts.activos` coherente con tmp_diag.
- Prueba 3 → Grep `caseCounts where` en ambos APIs = `NOT IN [CERRADO,ARCHIVADO]`.
- Prueba 4 → inspección `<option>` selector = 4 partes.
- Prueba 5 → Grep `/api/admin/casos.ts:L83` = `active:true` incluido en where abogados.
- Prueba 6 → Grep `sort|orderBy|rank|>=` en selector render = 0 coincidencias.
- `tsc --noEmit` exit 0.
- `eslint` exit 0.

---

## Risks
| Riesgo | Manejo |
|---|---|
| Conteos lentos si >100 abogados | Alternativa interna (sin Prisma): usar `groupBy` de Prisma en Step 1 (`groupBy: { by: [abogadoId, status], where: {...}, _count: true }`) — mismo schema, distinta query, performance 1 query vs N. Implementado en el Step 1 si count por user es lento; **planificado pero aplicable ahorrando N+1** |
| User.specialty=null en abogados nuevos | UI muestra `—` sin romper; allowlist PATCH lo obliga a null permitido (OK). |
| MESA aprueba multi-especialidad/cobertura multi-municipio/disponibilidad manual AHORA | **Detener ejecución inmediatamente y reportar necesidad Prisma con schema propuesto. No implementar workarounds inadecuados.** |
