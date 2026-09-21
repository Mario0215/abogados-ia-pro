import { CaseMemoryService, CaseContext } from '../services/caseMemory.service';

export type ProcesalAnalysis = {
  etapa_actual: string;
  siguiente_paso: string;
  riesgos_procesales: string[] | string;
  documentos_faltantes: string[] | string;
  advertencias: string[] | string;
  version?: string;
  generated_at?: string;
  confidence?: number;
};

export class ProcesalAgent {
  private caseId: string;
  constructor(caseId: string) {
    this.caseId = caseId;
  }

  async analyze(): Promise<ProcesalAnalysis> {
    const memory: CaseContext = await CaseMemoryService.getCaseContext(this.caseId);
    const apiKey =
      process.env.OPENAI_API_KEY || (process.env.CLAVE_API_DE_OPENAI as string) || '';
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }
    const prompt = [
      'Actúa como abogado litigante experto en derecho procesal civil mexicano.',
      'Analiza el expediente y responde ÚNICAMENTE en JSON válido con el siguiente esquema:',
      '{',
      '  "etapa_actual": "DEMANDA|PRESENTACION|ADMISION|EMPLAZAMIENTO|CONTESTACION|PRUEBAS|AUDIENCIA_FINAL|SENTENCIA|OTRA",',
      '  "siguiente_paso": "texto conciso",',
      '  "riesgos_procesales": ["texto", "..."],',
      '  "documentos_faltantes": ["concepto", "..."],',
      '  "advertencias": ["texto", "..."]',
      '}',
      '',
      `Tipo de juicio: ${memory.intent || '—'}`,
      `Hechos: ${memory.facts || '—'}`,
      `Estatus actual: ${memory.status}`,
      `Documentos existentes: ${memory.attachments.join(', ') || '—'}`,
      `Juzgado: ${(memory.courtType || '—')} ${(memory.courtNumber || '')}`.trim(),
      ''
    ].join('\n');

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' as const },
      messages: [{ role: 'user', content: prompt }]
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status} ${text}`);
    }
    const data: any = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        etapa_actual: 'OTRA',
        siguiente_paso: 'Revisar manualmente',
        riesgos_procesales: ['Salida no JSON del modelo'],
        documentos_faltantes: [],
        advertencias: []
      };
    }
    return {
      ...parsed,
      version: '1.0.0',
      generated_at: new Date().toISOString()
    } as ProcesalAnalysis;
  }
}

