export type CheckItem = { key: string; ok: boolean };
export type CheckStatus = 'VERDE' | 'AMARILLO' | 'ROJO';
export type CheckResult = { status: CheckStatus; items: CheckItem[] };

export function evaluateDemandaChecklist(input: {
  clientName?: string;
  counterparty?: string;
  actorAddress?: string;
  pretension?: string;
  facts?: string;
  draftText?: string;
}): CheckResult {
  const nameOk = !!String(input.clientName || '').trim();
  const counterpartyOk = !!String(input.counterparty || '').trim();
  const addressOk = !!String(input.actorAddress || '').trim();
  const pretOk = !!String(input.pretension || '').trim();
  const factsOk = !!String(input.facts || '').trim();
  const text = String(input.draftText || '');
  const lengthOk = text.replace(/\s+/g, ' ').trim().length >= 300;
  const hasHechosSection = /(^|\n)\s*HECHOS(\s*:|\s*\n)/i.test(text);
  const hasPetitorios = /(PETICIONES|PUNTOS\s+PETITORIOS|POR\s+LO\s+EXPUETO|POR\s+LO\s+EXPU|PUNTOS\s+PETITORIOS)/i.test(text);
  const hasFundamentos = /(ART[IÍ]CULO|Artículo)/.test(text);
  const items: CheckItem[] = [
    { key: 'actor', ok: nameOk },
    { key: 'demandado', ok: counterpartyOk },
    { key: 'domicilio_actor', ok: addressOk },
    { key: 'pretension', ok: pretOk },
    { key: 'hechos', ok: factsOk },
    { key: 'longitud', ok: lengthOk },
    { key: 'seccion_hechos', ok: hasHechosSection },
    { key: 'petitorios', ok: hasPetitorios },
    { key: 'fundamentos', ok: hasFundamentos },
  ];
  const criticalFail = !(nameOk && counterpartyOk && addressOk && pretOk && factsOk && lengthOk);
  const improvementFail = !(hasHechosSection && hasPetitorios && hasFundamentos);
  const status: CheckStatus = criticalFail ? 'ROJO' : (improvementFail ? 'AMARILLO' : 'VERDE');
  return { status, items };
}
