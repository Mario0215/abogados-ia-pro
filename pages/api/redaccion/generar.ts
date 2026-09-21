import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { getCaseFinancialSummary } from '../../../lib/finance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return res.status(403).json({ error: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId } = req.body || {};
  if (!caseId) return res.status(400).json({ error: 'caseId requerido' });

  const apiKey = process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  const lc = await prisma.legalCase.findUnique({
    where: { id: String(caseId) },
    include: { client: true }
  });
  if (!lc) return res.status(404).json({ error: 'Caso no encontrado' });
  if (!canAccessLegalCase(auth, lc)) return res.status(404).json({ error: 'Caso no encontrado' });

  try {
    const financial = await getCaseFinancialSummary(prisma as any, String(caseId));
    const precio = typeof financial?.precioCliente === 'number' ? Number(financial.precioCliente) : 0;
    const required = precio > 0 ? Math.round(precio * 0.5) : 0;
    if (required > 0) {
      const paid = Number(financial?.totalCobrado || 0);
      if (paid < required) {
        return res.status(402).json({ error: 'Pago pendiente', required, paid });
      }
    }
  } catch {
    return res.status(503).json({ error: 'No fue posible validar el estado de pago del expediente.' });
  }

  // Leer campos raw SQL
  let counterpartyAddress: string | null = null;
  let facts: string | null = null;
  let questionnaireData: any = null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ counterpartyAddress: string | null; facts: string | null; questionnaireData: string | null }>>(
      `SELECT "counterpartyAddress","facts","questionnaireData" FROM "LegalCase" WHERE "id" = $1`, String(caseId)
    );
    counterpartyAddress = rows?.[0]?.counterpartyAddress || null;
    facts = rows?.[0]?.facts || null;
    if (rows?.[0]?.questionnaireData) {
      try { questionnaireData = JSON.parse(rows[0].questionnaireData); } catch {}
    }
  } catch {}

  // Artículos relevantes del RAG — organizados por sección legal
  const qType = questionnaireData?.questionnaireType || (questionnaireData?.divorceType ? 'divorcio' : null);
  const demandType: string | null = qType || null;

  type ArticuloConSeccion = { title: string; snippet: string | null; sourceType: string | null; legalSection: string | null };
  let articulosPorSeccion: { hechos: ArticuloConSeccion[]; derecho: ArticuloConSeccion[]; prestaciones: ArticuloConSeccion[]; otros: ArticuloConSeccion[] } = { hechos: [], derecho: [], prestaciones: [], otros: [] };
  let usedTagged = false;

  try {
    if (demandType) {
      const taggedRows = await prisma.$queryRawUnsafe<Array<{ title: string; snippet: string | null; sourceType: string | null; legalSection: string | null }>>(
        `SELECT "title", LEFT("content", 350) AS "snippet", "sourceType", "legalSection"
         FROM "Document"
         WHERE "active" = true
           AND "demandTags" IS NOT NULL
           AND "demandTags" != '[]'
           AND "demandTags" ILIKE $1
           AND "content" IS NOT NULL
         ORDER BY "sourceType", "title"
         LIMIT 18`,
        `%${demandType}%`
      );
      if (taggedRows.length > 0) {
        usedTagged = true;
        for (const r of taggedRows) {
          let secciones: string[] = [];
          try { secciones = JSON.parse(r.legalSection || '[]'); } catch {}
          const art = { title: r.title, snippet: r.snippet, sourceType: r.sourceType, legalSection: r.legalSection };
          if (secciones.includes('HECHOS')) articulosPorSeccion.hechos.push(art);
          if (secciones.includes('DERECHO')) articulosPorSeccion.derecho.push(art);
          if (secciones.includes('PRESTACIONES')) articulosPorSeccion.prestaciones.push(art);
          if (!secciones.length) articulosPorSeccion.otros.push(art);
        }
      }
    }
    // Fallback: CaseKnowledge genérico si no hay artículos etiquetados
    if (!usedTagged) {
      const rows = await prisma.$queryRaw<Array<{ title: string; snippet: string | null; sourceType: string | null; score: number }>>`
        SELECT d."title", k."snippet", k."sourceType", k."score"
        FROM "CaseKnowledge" k
        JOIN "Document" d ON d."id" = k."documentId"
        WHERE k."caseId" = ${String(caseId)}
        ORDER BY k."score" DESC NULLS LAST
        LIMIT 8
      `;
      articulosPorSeccion.otros = (rows as any).map((r: any) => ({ ...r, legalSection: null }));
    }
  } catch {}

  // Notas del abogado
  let notasAbogado = '';
  try {
    const n = String((lc as any).notes || '').trim();
    if (n) {
      const parsed = JSON.parse(n);
      const arr = Array.isArray(parsed?.lawyerNotes) ? parsed.lawyerNotes : [];
      notasAbogado = arr.join('\n');
    }
  } catch {}

  function formatSeccion(arts: ArticuloConSeccion[]): string {
    return arts.map(a => `- ${a.title}${a.snippet ? ': ' + String(a.snippet).slice(0, 200) : ''}`).join('\n');
  }
  const { hechos, derecho, prestaciones, otros } = articulosPorSeccion;
  const totalArts = hechos.length + derecho.length + prestaciones.length + otros.length;
  let articulosTexto = '';
  if (totalArts === 0) {
    articulosTexto = 'No se encontraron artículos relevantes en la base de conocimiento.';
  } else if (usedTagged && (hechos.length + derecho.length + prestaciones.length) > 0) {
    // Presentación por sección cuando hay artículos etiquetados con sección
    const partes: string[] = [];
    if (hechos.length) partes.push(`SECCIÓN HECHOS (sustento fáctico — Código Civil):\n${formatSeccion(hechos)}`);
    if (derecho.length) partes.push(`SECCIÓN DERECHO (fundamento procesal — Código de Procedimientos Civiles):\n${formatSeccion(derecho)}`);
    if (prestaciones.length) partes.push(`SECCIÓN PRESTACIONES (base para lo reclamado):\n${formatSeccion(prestaciones)}`);
    if (otros.length) partes.push(`OTROS ARTÍCULOS RELEVANTES:\n${formatSeccion(otros)}`);
    articulosTexto = partes.join('\n\n');
  } else {
    // Lista plana (fallback o artículos sin sección asignada)
    articulosTexto = formatSeccion([...hechos, ...derecho, ...prestaciones, ...otros]);
  }

  // Build questionnaire-specific context
  const q = questionnaireData;
  let divorceContext = '';

  if (q?.divorceType) {
    // ── Divorcio ──
    const hijos = Array.isArray(q.hijos) && q.hijos.length > 0
      ? q.hijos.map((h: any) => `${h.nombre} (${h.edad} años)`).join(', ')
      : null;
    const hijosLine = q.tieneHijos === false ? 'No tienen hijos menores de edad.'
      : hijos ? `Hijos menores: ${hijos}. Guarda y custodia: ${q.guardaCustodia || '[COMPLETAR]'}. Pensión alimenticia para hijos: ${q.pensionHijos ? '$' + q.montoPensionHijos + '/mes' : 'No acordada'}.`
      : 'Situación de hijos: [COMPLETAR]';
    const regimen = q.regimenPatrimonial === 'SOCIEDAD_CONYUGAL' ? 'Sociedad conyugal' : q.regimenPatrimonial === 'SEPARACION_BIENES' ? 'Separación de bienes' : '[COMPLETAR]';

    if (q.divorceType === 'MUTUO_ACUERDO') {
      divorceContext = `
TIPO DE DIVORCIO: Voluntario por mutuo consentimiento (Art. 267 CC Gto.)

DATOS DEL MATRIMONIO:
- Fecha de celebración: ${q.fechaMatrimonio || '[COMPLETAR]'}
- Lugar: ${q.lugarMatrimonio || '[COMPLETAR]'}
- Régimen patrimonial: ${regimen}

SITUACIÓN FAMILIAR: ${hijosLine}

CONVENIO REGULADOR:
- Bienes comunes: ${q.tienenBienes === false ? 'No tienen bienes comunes.' : q.descripcionBienes || '[COMPLETAR]'}
${q.tienenBienes ? `- División acordada: ${q.divisionBienes || '[COMPLETAR]'}` : ''}
- Pensión entre cónyuges: ${q.pensionConyuge ? `$${q.montoPensionConyuge}/mes por ${q.duracionPension || '[COMPLETAR]'}` : 'No habrá pensión entre cónyuges.'}
- Domicilio conyugal: ${q.domicilioConyugal === 'ACTOR' ? `Se asigna al actor (${lc.client?.name || 'actor'})` : q.domicilioConyugal === 'DEMANDADO' ? `Se asigna al demandado (${(lc as any).counterparty || 'demandado'})` : 'Se dispondrá de él de común acuerdo.'}`;
    } else if (q.divorceType === 'CONTENCIOSO') {
      divorceContext = `
TIPO DE DIVORCIO: Necesario / Contencioso

DATOS DEL MATRIMONIO:
- Fecha de celebración: ${q.fechaMatrimonio || '[COMPLETAR]'}
- Lugar: ${q.lugarMatrimonio || '[COMPLETAR]'}
- Régimen patrimonial: ${regimen}

CAUSAL INVOCADA: ${q.causal || '[COMPLETAR]'}

DESCRIPCIÓN DE LA CAUSAL:
${q.descripcionCausal || '[COMPLETAR]'}

EVIDENCIA DISPONIBLE: ${q.tieneEvidencia ? (Array.isArray(q.tipoEvidencia) && q.tipoEvidencia.length ? q.tipoEvidencia.join(', ') : 'Sí, tipo no especificado') : 'No especificada aún.'}

SITUACIÓN FAMILIAR: ${hijosLine}`;
    }

  } else if (q?.questionnaireType === 'alimentos') {
    // ── Pensión alimenticia ──
    const relacionLabel: Record<string, string> = {
      MATRIMONIO: 'Cónyuges (matrimonio)',
      CONCUBINATO: 'Concubinos',
      FILIACION: 'Filiación (hijo/hija)',
      OTRO: 'Otro parentesco',
    };
    const modalidadLabel: Record<string, string> = {
      DESCUENTO_NOMINA: 'Descuento vía nómina',
      DEPOSITO: 'Depósito bancario',
      EFECTIVO: 'Pago en efectivo',
    };
    divorceContext = `
TIPO DE DEMANDA: Pensión Alimenticia

RELACIÓN ENTRE LAS PARTES: ${relacionLabel[q.relacionPartes] || '[COMPLETAR]'}
${q.descripcionRelacion ? `Descripción: ${q.descripcionRelacion}` : ''}

ACREEDOR ALIMENTARIO (actor):
- Ocupación: ${q.ocupacionAcreedor || '[COMPLETAR]'}
- Ingresos mensuales: ${q.ingresosMensualesAcreedor || 'Sin ingresos / [COMPLETAR]'}

NECESIDADES MENSUALES DEL ACREEDOR:
- Alimentación: ${q.gastosAlimentacion || '$0.00'}
- Salud/medicamentos: ${q.gastosMedicamentos || '$0.00'}
- Vivienda: ${q.gastosVivienda || '$0.00'}
- Educación: ${q.gastosEducacion || '$0.00'}
- Transporte: ${q.gastosTransporte || '$0.00'}
- Otros: ${q.otrosGastos || '$0.00'}
- TOTAL NECESIDADES: ${q.totalNecesidades ? `$${parseFloat(q.totalNecesidades).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '[COMPLETAR]'}

DEUDOR ALIMENTARIO (demandado):
- Ocupación: ${q.ocupacionDeudor || '[COMPLETAR]'}
- Patrón/Empresa: ${q.patronDeudor || '[COMPLETAR]'}
- Ingresos mensuales estimados: ${q.ingresosMensualesDeudor || '[COMPLETAR]'}
${q.tieneOtrosObligados === true ? '- Existen otros obligados alimentarios.' : q.tieneOtrosObligados === false ? '- No existen otros obligados alimentarios.' : ''}

PRESTACIONES SOLICITADAS:
- Monto de pensión: ${q.montoPensionSolicitada || '[COMPLETAR]'} mensuales
- Modalidad de pago: ${modalidadLabel[q.modalidadPago] || '[COMPLETAR]'}
- Pensión provisional: ${q.pensionProvisional ? 'Sí, se solicita pensión provisional durante el juicio.' : 'No se solicita pensión provisional.'}`;

  } else if (q?.questionnaireType === 'arrendamiento') {
    // ── Arrendamiento ──
    const accionLabel: Record<string, string> = {
      COBRO_RENTAS: 'Cobro de rentas vencidas',
      DESAHUCIO: 'Desahucio / Desocupación',
      RESCISION: 'Rescisión de contrato',
      TERMINACION: 'Terminación anticipada',
    };
    divorceContext = `
TIPO DE DEMANDA: Arrendamiento — ${accionLabel[q.tipoAccion] || '[COMPLETAR]'}
TIPO DE INMUEBLE: ${q.tipoInmueble === 'HABITACIONAL' ? 'Habitacional' : q.tipoInmueble === 'COMERCIAL' ? 'Comercial' : '[COMPLETAR]'}

INMUEBLE ARRENDADO:
${q.descripcionInmueble || '[COMPLETAR]'}

CONTRATO DE ARRENDAMIENTO:
- Fecha del contrato: ${q.fechaContrato || '[COMPLETAR]'}
- Inicio de ocupación: ${q.fechaInicio || '[COMPLETAR]'}
- Duración: ${q.duracionContrato || '[COMPLETAR]'}
- Renta mensual pactada: ${q.montoRentaMensual || '[COMPLETAR]'}
- Depósito en garantía: ${q.depositoGarantia || 'No hubo / [COMPLETAR]'}
- Contrato escrito: ${q.tieneContrato === true ? 'Sí, existe contrato escrito.' : q.tieneContrato === false ? 'No existe contrato escrito (arrendamiento verbal).' : '[COMPLETAR]'}

${(q.tipoAccion === 'COBRO_RENTAS' || q.tipoAccion === 'DESAHUCIO') ? `ADEUDO:
- Mensualidades adeudadas: ${q.mesesAdeudados || '[COMPLETAR]'}
- Período: ${q.periodoAdeudo || '[COMPLETAR]'}
- Monto total adeudado: ${q.montoTotalAdeudo || '[COMPLETAR]'}` : ''}
${(q.tipoAccion === 'RESCISION' || q.tipoAccion === 'TERMINACION') ? `CAUSA DE RESCISIÓN/TERMINACIÓN:
${q.causaRescision || '[COMPLETAR]'}` : ''}

NOTIFICACIÓN PREVIA: ${q.notificacionPrevia === true ? `Sí, se notificó al arrendatario con fecha ${q.fechaNotificacion || '[COMPLETAR]'}.` : q.notificacionPrevia === false ? 'No se realizó notificación previa.' : '[COMPLETAR]'}`;

  } else if (q?.questionnaireType === 'usucapion') {
    // ── Prescripción adquisitiva ──
    const caracteres = [
      q.posesionTituloDueño === true ? 'En concepto de dueño: SÍ' : 'En concepto de dueño: NO/DUDOSO',
      q.posesionPublica === true ? 'Pública: SÍ' : 'Pública: NO/DUDOSO',
      q.posesionPacifica === true ? 'Pacífica: SÍ' : 'Pacífica: NO/DUDOSO',
      q.posesionContinua === true ? 'Continua e ininterrumpida: SÍ' : 'Continua: NO/DUDOSO',
    ].join(' | ');
    divorceContext = `
TIPO DE DEMANDA: Prescripción Adquisitiva (Usucapión) — Art. 826 y ss. CC Gto.
TIPO DE BIEN: ${q.tipoBien === 'INMUEBLE' ? 'Bien inmueble' : q.tipoBien === 'MUEBLE' ? 'Bien mueble' : '[COMPLETAR]'}

DESCRIPCIÓN DEL BIEN:
${q.descripcionBien || '[COMPLETAR]'}
- Ubicación: ${q.ubicacionBien || '[COMPLETAR]'}
- Superficie: ${q.superficieBien || '[COMPLETAR]'}
- Clave catastral: ${q.claveCatastral || '[COMPLETAR]'}

PROPIETARIO REGISTRAL: ${q.propietarioRegistral || '[COMPLETAR]'}
TÍTULO CON QUE SE POSEE: ${q.tituloPrevio || '[COMPLETAR]'}

POSESIÓN:
- Fecha de inicio: ${q.fechaInicioPosesion || '[COMPLETAR]'}
- Años de posesión: ${q.añosPosesion || '[COMPLETAR]'}
- Forma de adquisición: ${q.formaAdquisicion || '[COMPLETAR]'}

CARACTERÍSTICAS (Art. 826 CC Gto.):
${caracteres}

ACTOS POSESORIOS REALIZADOS:
${q.actosPosesorios || '[COMPLETAR]'}
- Pagos de predial: ${q.pagosPredial === true ? 'Sí' : q.pagosPredial === false ? 'No' : '[COMPLETAR]'}
- Construcciones/mejoras: ${q.realizoConstrucciones === true ? `Sí — ${q.descripcionMejoras || '[COMPLETAR]'}` : 'No'}
- Testigos disponibles: ${q.testigos === true ? 'Sí' : q.testigos === false ? 'No' : '[COMPLETAR]'}`;
  }

  // Prefer questionnaire narrative facts over stored facts
  const factsText = (q?.hechosNarrativos?.trim()) || (facts && facts.trim()) || '[El abogado debe completar los hechos en la sección correspondiente]';

  const prompt = `Eres un abogado litigante civil experto en derecho mexicano con 20 años de experiencia. Redacta una demanda civil FORMAL y COMPLETA en formato de tribunal mexicano, usando los datos exactos proporcionados. No inventes datos que no estén presentes.

DATOS DE LAS PARTES:
- Actor (demandante): ${lc.client?.name || '[SIN NOMBRE]'}
- Domicilio del actor: ${lc.client?.address || '[SIN DOMICILIO]'}
- Teléfono del actor: ${lc.client?.phone || '[SIN TELÉFONO]'}
- Correo del actor: ${lc.client?.email || '[SIN CORREO]'}
- Demandado: ${(lc as any).counterparty || '[SIN NOMBRE]'}
- Domicilio de emplazamiento del demandado: ${counterpartyAddress || '[SIN DOMICILIO DE EMPLAZAMIENTO]'}
- Número de expediente: ${(lc as any).expediente || '[PENDIENTE]'}
- Pretensión / Tipo de demanda: ${(lc as any).intent || '[SIN DEFINIR]'}
${divorceContext ? `\n${divorceContext}` : ''}

HECHOS DEL CASO:
${factsText}

FUNDAMENTOS LEGALES (organizados por sección cuando aplica):
${articulosTexto}

${notasAbogado ? `NOTAS DEL ABOGADO:\n${notasAbogado}` : ''}

INSTRUCCIONES:
1. Usa el formato estándar de demanda civil ordinaria para tribunales del Estado de Guanajuato.
2. Incluye: encabezado dirigido al Juez, presentación del actor, PRESTACIONES reclamadas (al menos 3 específicas al tipo de demanda), HECHOS numerados, DERECHO fundado en los artículos proporcionados, y PUNTOS PETITORIOS.
3. El domicilio de emplazamiento del demandado es CRÍTICO — inclúyelo explícitamente en los puntos petitorios.
4. Usa los datos del cuestionario para construir prestaciones y hechos precisos (no genéricos). Cada tipo de demanda tiene prestaciones distintas:
   - Divorcio: disolución del vínculo, guarda y custodia, pensión alimenticia, división de bienes, etc.
   - Pensión alimenticia: pago de pensión mensual, pensión provisional, forma de pago (descuento nómina/depósito).
   - Arrendamiento cobro de rentas: pago de rentas vencidas, intereses, desocupación del inmueble.
   - Arrendamiento desahucio/rescisión: desocupación y entrega del inmueble, pago de adeudos, daños y perjuicios.
   - Usucapión: declaración de propiedad por prescripción adquisitiva, inscripción en Registro Público.
5. Usa los artículos organizados por sección: los de "SECCIÓN HECHOS" apóyalos en la narración de hechos, los de "SECCIÓN DERECHO" cítalos en el capítulo de Derecho, los de "SECCIÓN PRESTACIONES" úsalos para fundamentar lo reclamado.
6. Si algún dato está como [COMPLETAR] o [SIN ...], mantenlo así para que el abogado lo llene.
7. Usa lenguaje jurídico formal. No uses marcadores como ** o ##.
8. Termina con "PROTESTO LO NECESARIO" y espacio para firma.`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(502).json({ error: 'Error OpenAI: ' + (err?.error?.message || resp.status) });
    }
    const data = await resp.json();
    const generated = data?.choices?.[0]?.message?.content || '';
    if (!generated) return res.status(502).json({ error: 'La IA no devolvió texto' });
    return res.status(200).json({ text: generated });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error generando demanda: ' + (e?.message || '') });
  }
}
