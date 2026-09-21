import { prisma } from '../prisma';

export type CaseContext = {
  id: string;
  intent: string | null;
  facts: string | null;
  status: string;
  expediente: string;
  clientName: string | null;
  counterparty: string | null;
  courtNumber: string | null;
  courtType: string | null;
  attachments: string[];
};

export class CaseMemoryService {
  static async getCaseContext(caseId: string): Promise<CaseContext> {
    const lc = await prisma.legalCase.findUnique({
      where: { id: caseId },
      include: { attachments: true, client: true }
    });
    if (!lc) {
      throw new Error('Caso no encontrado');
    }
    const attachments = (lc.attachments || []).map((a: any) => String(a?.concept || a?.originalName || 'DOCUMENTO'));
    const facts = (lc as any).facts ?? null;
    const courtNumber = (lc as any).courtNumber ?? null;
    const courtType = (lc as any).courtType ?? null;
    return {
      id: lc.id,
      intent: lc.intent || null,
      facts: facts ? String(facts) : null,
      status: lc.status,
      expediente: lc.expediente,
      clientName: lc.client?.name || null,
      counterparty: lc.counterparty || null,
      courtNumber: courtNumber ? String(courtNumber) : null,
      courtType: courtType ? String(courtType) : null,
      attachments
    };
  }
}

