# Fase 5A — Seguimiento Procesal Operativo (SIN Prisma / SIN migraciones)

Fecha plan: 2026-09-20
Alcance: Agenda correcta por abogado asignado + VENCIDO runtime + Actuaciones CaseEvent + Mejoras detalle expediente + Filtros Agenda
Prohibido: Prisma schema, migraciones, LegalCore, filingDate, proceduralPhase, Document/RAG, Stripe, portal cliente, comisiones, Fase 6

---

## 1. Bloqueos Prisma detectados (NO se implementan workarounds peligrosos)

### BLOQUEO 1 — CaseAttachment `@@unique([caseId, concept])` destruye documentos históricos
- **Problema**: Prisma schema L192 `@@unique([caseId, concept])` fuerza un solo attachment por expediente y valor de `concept`. Además `/api/cases/upload.ts` L32-38 hace `DELETE previous` al subir archivo con mismo concept. Esto IMPIDE:
  - Subir 2 promociones del mismo tipo (ej: 2 escritos de promoción de prueba)
  - Subir varios acuerdos letrados del expediente
  - Cualquier documento posterior repetible por tipo
- **Por qué modelo actual no alcanza**: La restricción unique + delete previous sobreescribe silenciosamente documentos anteriores en GCS y BD. Historial perdido = NO recuperable.
- **Propuesta mínima Prisma**: Quitar `@@unique([caseId, concept])`; dejar `concept` solo como campo clasificatorio no único; quitar el delete previous en upload.ts, document.ts, export-demanda.ts y cualquier consumer.
- **Archivos afectados si se resolviera**: `prisma/schema.prisma`, `pages/api/cases/upload.ts`, `pages/api/cases/document.ts`, `pages/demandas/export-demanda.ts` (buscar patrón `caseId_concept`)
- **Decisión F5A**: REPORTAR únicamente. NO implementar flujo upload de "promoción/acuerdo" con concept tipificado. Permitir upload solo con `concept=null` (sin clasificación) donde unique no aplica (SQL NULL no se compara en unique index). NINGÚN workaround como `PROMOCION_${Date.now()}` porque rompe consultas semánticas y NO corrige el delete previous en otros consumers.

### BLOQUEO 2 — Sin entidad Audiencia en Prisma
- **Problema**: No existe tabla CaseHearing/Audiencia con campos sala, hora, tipo, resolución, resumen.
- **Por qué modelo actual no alcanza**: CaseEvent.type String + CaseDeadline.title permiten registrar "audiencia X" como evento o plazo, pero sin estructura (sala, hora, parte convocada, resultado).
- **Propuesta mínima Prisma**: Model `CaseHearing { id, caseId, fechaHora, tipo, sala, resultado, resumen, createdAt }` + FK a LegalCase.
- **Archivos afectados si se resolviera**: `prisma/schema.prisma`, nuevos endpoints, nuevo tab en detalle.
- **Decisión F5A**: Cumplir instrucción user: NO crear entidad. Si se representa temporalmente, usar CaseEvent.type="AUDIENCIA" + mensaje libre o CaseDeadline.title="Audiencia oral X". Etiqueta visible: "Audiencia (registro operativo simple)". NUNCA presentar como audiencia procesal estructurada completa.

### BLOQUEO 3 — DeadlineStatus enum NO incluye VENCIDO (NO Prisma)
- **Problema**: Prisma enum L248 DeadlineStatus = PENDIENTE | CUMPLIDO | CANCELADO. No existe VENCIDO en BD.
- **Decisión F5A**: CALCULAR VENCIDO en runtime (no Prisma). Ver paso 2.

---

## 2. Pasos de implementación Fase 5A (SIN Prisma)

### PASO 1 — Corregir ownership: Agenda ABOGADO ve plazos por CASO ASIGNADO (no creador)
**Bug actual**:
- `pages/agenda/index.tsx` L179 SSR: `where: { userId: auth.uid }` = filtra por CREADOR del plazo. Si ADMIN creó plazo para caso asignado a ABOGADO → ABOGADO NO LO VE. ❌
- `pages/api/deadlines.ts` L69 GET: `where: any = auth.role === 'ADMIN' ? {} : { userId: auth.uid }` = mismo bug. ❌

**Corrección SIN Prisma** (filtro por padre LegalCase.abogadoId):

#### 1a) `pages/agenda/index.tsx` L172-203 SSR
- ABOGADO: reemplazar `where { userId }` por subquery/include con padre `LegalCase.abogadoId === auth.uid`
  ```tsx
  const where: any = auth.role === 'ADMIN'
    ? {}
    : { case: { is: { abogadoId: auth.uid } } };  // ✅ filtro por padre caso asignado
  const items = await prisma.caseDeadline.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    take: 200,
    include: { case: { select: { expediente: true, client: { select: { name: true }}}} }
  });
  ```
- También: SSR Agenda solo acepta role ABOGADO (L175). Mantener ADMIN redirect a su panel o habilitar ambos según convenga (F3 actual Agenda era abogado-only; dejar como está a menos que user lo cambie).
- ADMIN acceso total: Si user desea ADMIN también use /agenda, cambiar L175 de rol check; por defecto dejar actual y ADMIN usa panel-demo.

#### 1b) `pages/api/deadlines.ts` L66-80 GET
```ts
// Reemplazar L69:
const where: any = {};
if (auth.role !== 'ADMIN') {
  where.case = { is: { abogadoId: auth.uid } };  // ✅ padre caso asignado
}
if (caseId) {
  where.caseId = String(caseId);
  // Para endpoints de detalle (caseId presente), ya canAccessLegalCase via PUT valida; pero GET con caseId debe validar ownership también:
  if (auth.role !== 'ADMIN') {
    const lc = await prisma.legalCase.findUnique({ where: { id: String(caseId) }, select: { id: true, abogadoId: true, userId: true }});
    if (!canAccessLegalCase(auth, lc, true)) return res.status(403).json({ error: 'No autorizado' });
  }
}
```
- Mantener POST/PUT/DELETE L82-132 como están: ya usan `canAccessLegalCase(auth, lc, true)` via padre before.caseId → correctos.

---

### PASO 2 — Helper VENCIDO calculado + alertas objetivas (hoy / 1d / 3d / 5d / VENCIDO)
**Objetivo**: Sin Prisma, calcular estado runtime SIN tocar enum DeadlineStatus.

**Nuevo helper reutilizable** (crear `lib/deadline.ts` o agregar en `lib/auth.ts` si pequeño; mejor `lib/deadline.ts` dedicado):

```ts
// Tipos app-layer (no Prisma)
export type ComputedDeadlineStatus = 'PENDIENTE' | 'CUMPLIDO' | 'CANCELADO' | 'VENCIDO';

export interface DeadlineAlert {
  label: string;           // "Vence hoy" | "En 1 día" | "En 3 días" | "En 5 días" | "VENCIDO" | ""
  variant: 'red' | 'amber' | 'yellow' | 'blue' | 'muted' | 'green' | 'gray';
  daysDiff: number;        // >0 = días faltantes; <0 = días vencido; 0 = hoy
}

export function computeDeadlineStatus(dueDateISO: string | Date, dbStatus: string): ComputedDeadlineStatus {
  if (dbStatus === 'CUMPLIDO' || dbStatus === 'CANCELADO') return dbStatus as ComputedDeadlineStatus;
  const due = new Date(dueDateISO);
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dueStart = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
  return dueStart.getTime() < todayStart.getTime() ? 'VENCIDO' : 'PENDIENTE';
}

export function computeDeadlineAlert(dueDateISO: string | Date, dbStatus: string): DeadlineAlert {
  const computed = computeDeadlineStatus(dueDateISO, dbStatus);
  if (computed === 'CUMPLIDO') return { label: 'Cumplido', variant: 'green', daysDiff: 0 };
  if (computed === 'CANCELADO') return { label: 'Cancelado', variant: 'gray', daysDiff: 0 };
  const due = new Date(dueDateISO);
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dueStart = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((dueStart.getTime() - todayStart.getTime()) / msPerDay);
  if (computed === 'VENCIDO') return { label: 'VENCIDO', variant: 'red', daysDiff };
  if (daysDiff === 0) return { label: 'Vence hoy', variant: 'red', daysDiff: 0 };
  if (daysDiff <= 1) return { label: 'En 1 día', variant: 'amber', daysDiff };
  if (daysDiff <= 3) return { label: 'En 3 días', variant: 'yellow', daysDiff };
  if (daysDiff <= 5) return { label: 'En 5 días', variant: 'blue', daysDiff };
  return { label: '', variant: 'muted', daysDiff };
}
```

**Variantes CSS**: mapear `variant → backgroundColor + color` usando paleta de colores existente `C.redBg/C.red, C.amberBg/C.amber, C.yellowBg/C.yellow o C.faint según paleta existente`. No introducir colores nuevos no usados.

---

### PASO 3 — Agenda: conteo VENCIDO correcto + chips alerta + filtro expediente
**Archivo**: `pages/agenda/index.tsx`

#### 3a) Conteo VENCIDO correcto L36-42
Bug actual: `VENCIDO: rows.filter(r => r.status === 'VENCIDO').length` siempre 0 (VENCIDO no está en BD).
Corrección: antes de conteo mapear rows a estado computado:
```tsx
const rowsComputed = rows.map(r => ({ ...r, computedStatus: computeDeadlineStatus(r.dueDate, r.status) }));
const conteo = {
  TODOS: rowsComputed.length,
  PENDIENTE: rowsComputed.filter(r => r.computedStatus === 'PENDIENTE').length,
  VENCIDO: rowsComputed.filter(r => r.computedStatus === 'VENCIDO').length,
  CUMPLIDO: rowsComputed.filter(r => r.computedStatus === 'CUMPLIDO').length,
  CANCELADO: rowsComputed.filter(r => r.computedStatus === 'CANCELADO').length,
};
```

#### 3b) Filtro cliente-side por estado computado (no DB status)
- Chips TODOS/PENDIENTE/VENCIDO/CUMPLIDO/CANCELADO (actualmente existen). Ajustar lógica de filtrado para usar `computedStatus` en vez de `r.status`.

#### 3c) Filtro expediente
Añadir input/select arriba de tabla: buscar por `r.expediente` incluye texto. Filtro cliente-side.

#### 3d) Chips alerta en filas tabla
Columna "Estado" (o nueva columna "Alerta"): mostrar chip de `computeDeadlineAlert(r.dueDate, r.status)`. Si computedStatus=CUMPLIDO/CANCELADO mostrar badge CUMPLIDO/CANCELADO actual. Si PENDIENTE/VENCIDO mostrar chip alerta según PASO 2.

---

### PASO 4 — /mis-casos/[id]: mejoras detalle expediente
**Archivo**: `pages/mis-casos/[id].tsx`

#### 4a) Header Próximo vencimiento hero
- Si hay `proxVto`: aplicar color dinámico usando `computeDeadlineAlert(proxVto.dueDate, proxVto.status)`.
  - VENCIDO → fondo rojo; "Vence hoy" → rojo; "1d" → ámbar; "3d" amarillo; resto azul/muted.
- Actualizar SSR L~include deadlines para incluir los PENDIENTE y luego en cliente calcular computed.

#### 4b) Tab Plazos (L497-533) mejoras
- Antes del render tabla: **separar rows en 2 grupos**:
  1. `vencidos = deadlines.filter(d => computeDeadlineStatus(d.dueDate, d.status) === 'VENCIDO')` → sub-sección arriba destacada "⚠ Plazos vencidos" con fondo rojo claro.
  2. `resto = deadlines` ordenados por dueDate asc.
- Columna Estado existente: reemplazar badge DB status por `computeDeadlineAlert()` para PENDIENTE/VENCIDO; mantener CUMPLIDO/CANCELADO igual.
- Mantener botón + Nuevo plazo igual.

#### 4c) Timeline (L718-762) +4 tipos ACTUACION / ACUERDO / PROMOCION / AUDIENCIA
- Extender map L720-721:
```tsx
const typeLabel: Record<string, string> = {
  STATUS: 'Estado',
  PRIORITY: 'Prioridad',
  ATTACHMENT: 'Documento',
  FEE: 'Honorarios',
  CONTEXT: 'Contexto',
  ACTUACION: 'Actuación',
  ACUERDO: 'Acuerdo',
  PROMOCION: 'Promoción',
  AUDIENCIA: 'Audiencia (registro operativo)',
};
const typeColor: Record<string, string> = {
  STATUS: C.blue,
  PRIORITY: C.amber,
  ATTACHMENT: C.green,
  FEE: C.muted,
  CONTEXT: C.faint,
  ACTUACION: C.teal ?? C.blue,
  ACUERDO: C.green,
  PROMOCION: '#7c3aed',  // violeta, si no existe usar C.blue
  AUDIENCIA: C.red,
};
```
- Orden cronológico: verificar que SSR events include L~orderBy createdAt sea ASCENDENTE para timeline (cronológico de viejo a nuevo). Si actual es DESC, agregar `.reverse()` en filtered antes de render o ajustar include orderBy. Actualmente L718 events vienen de SSR; revisar include orderBy.

---

### PASO 5 — Verificación de no filtración ABOGADO no ve casos ajenos
- Revisar que PASO 1a y 1b apliquen `abogadoId === auth.uid` para TODO ABOGADO non-ADMIN.
- Mantener `canAccessLegalCase(auth, lc, true)` = strictAbogado.

---

## 3. Archivos a modificar (F5A)

| Archivo | Alcance cambio |
|---------|---------------|
| `lib/deadline.ts` (NUEVO) | Helper computeDeadlineStatus + computeDeadlineAlert. Si lib/ existe, sí; si no, revisar estructura. |
| `pages/agenda/index.tsx` | SSR ownership abogadoId, conteo VENCIDO correcto, chips alerta, filtro expediente cliente-side |
| `pages/api/deadlines.ts` | GET ownership por padre LegalCase.abogadoId |
| `pages/mis-casos/[id].tsx` | Header ProxVto color, Tab Plazos sección Vencidos + chips alerta, Timeline +4 tipos |
| Opcional: `pages/mis-casos/index.tsx` | Si desea chips alerta en listado next-deadline de cada fila (no requerido F5A pero recomendado; decidir si incluir o no) |

---

## 4. Validaciones obligatorias F5A (verificar post-ejecución)

| # | Validación | Cómo verificar |
|---|-----------|----------------|
| 1 | ABOGADO ve plazos de SUS CASOS ASIGNADOS aunque ADMIN los creara (CaseDeadline.userId != auth.uid) | Crear plazo como ADMIN para caso con abogadoId=ABG_X → login ABG_X → Agenda y Tab Plazos deben mostrarlo |
| 2 | ABOGADO NO ve plazos de casos ajenos | Caso con abogadoId=ABG_Y → login ABG_X → no debe aparecer en Agenda ni detalle 404 en acceso directo |
| 3 | ADMIN ve todos los plazos | Login ADMIN → GET /api/deadlines retorna todos (si ADMIN tuviera acceso a agenda; si no, verificar en panel-demo si lo necesita) |
| 4 | VENCIDO calculado correctamente sin nuevo status Prisma | Plazo PENDIENTE con dueDate ayer → computedStatus = VENCIDO; conteo Agenda VENCIDO +=1; chip rojo "VENCIDO"; Tab Plazos sección Vencidos aparece |
| 5 | CUMPLIDO / CANCELADO no aparecen como pendientes/vencidos | Plazo dueDate ayer pero status=CUMPLIDO → computedStatus = CUMPLIDO; no en Vencidos; no chip VENCIDO |
| 6 | Timeline conserva historial (orden + tipos existentes) | Revisar que eventos STATUS/PRIORITY/ATTACHMENT/FEE/CONTEXT antiguos siguen visibles; cronológico ASC; no se pierden |
| 7 | Ningún documento histórico se sobreescribe | No subir 2 attachments con mismo concept tipificado (BLOQUEO 1 declarado); si se sube concept=null múltiples OK |

---

## 5. Restricciones reafirmadas

- NO Prisma schema; NO migraciones.
- NO tocar LegalCore, filingDate, proceduralPhase, Document/RAG/corpus, Stripe, portal cliente, comisiones, Fase 6.
- NO heurísticas sin umbrales MESA (F4 correctivo). Alertas PASO 2 = umbrales fijos 0/1/3/5 días objetivamente medidos, NO heurística de disponibilidad.
- NINGÚN workaround peligroso para BLOQUEO 1 CaseAttachment unique. REPORTAR solo.

---

## 6. Orden de ejecución

1. Crear `lib/deadline.ts` helper.
2. Corregir `pages/api/deadlines.ts` GET ownership.
3. Corregir `pages/agenda/index.tsx` SSR + conteo VENCIDO + chips alerta + filtro expediente.
4. Corregir `pages/mis-casos/[id].tsx`: Header ProxVto, Tab Plazos Vencidos+chips, Timeline +4 tipos.
5. TSC + ESLint focalizados.
6. Reporte final con 7 validaciones + bloqueos Prisma 3 declarados. NO avance F6.
7. (POSTERIOR, NO en F5A) Diagnóstico Fase 6 sin modificar archivos.
