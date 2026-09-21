import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import os from 'os';

type ImportKind = 'CC' | 'CPC';

function getArg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((v) => v.startsWith(pref));
  if (a) return a.slice(pref.length);
  return undefined;
}

async function ensureState(): Promise<string> {
  let st = await prisma.state.findFirst({ where: { name: 'Guanajuato' } });
  if (!st) st = await prisma.state.create({ data: { name: 'Guanajuato', active: true } });
  return st.id;
}

function splitArticles(raw: string): string[] {
  const norm = raw.replace(/\r/g, '').trim();
  const parts = norm.split(/(?=^Artículo\s+\d+)/gmu).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts;
}

async function resetGTO(stateId: string) {
  await prisma.document.deleteMany({ where: { stateId, sourceType: { in: ['CC', 'CPC'] } } });
}

async function upsertBatch(stateId: string, kind: ImportKind, parts: string[]) {
  const matter = 'CIVIL';
  const submatter = kind === 'CC' ? 'Sustantivo' : 'Procesal/Adjetivo';
  const jurisdiccion = 'ESTATAL';
  const prefix = kind === 'CC'
    ? 'del Código Civil para el Estado de Guanajuato'
    : 'del Código de Procedimientos Civiles para el Estado de Guanajuato';
  let up = 0;
  for (const part of parts) {
    const m = part.match(/^Artículo\s+(\d+)/i);
    const num = m ? m[1] : undefined;
    const title = num ? `Artículo ${num} ${prefix}` : `Artículo ${prefix}`;
    const d = await prisma.document.upsert({
      where: { stateId_title: { stateId, title } },
      update: { content: part, matter, submatter, jurisdiccion, active: true },
      create: { title, content: part, matter, submatter, jurisdiccion, stateId, active: true }
    });
    await prisma.$executeRawUnsafe(`UPDATE "Document" SET "sourceType"='${kind}' WHERE "id"='${(d as any).id}'`);
    up += 1;
  }
  return up;
}

async function main() {
  try {
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`); } catch {}
    const stateId = await ensureState();
    const reset = process.env.SEED_RESET === '1' || process.argv.includes('--reset');
    if (reset) await resetGTO(stateId);
    let ccPath = getArg('cc') || process.env.SEED_CC_FILE;
    let cpcPath = getArg('cpc') || process.env.SEED_CPC_FILE;
    if (!ccPath) {
      const home = os.homedir();
      const candidatesCC = [
        path.join(home, 'Desktop', 'CÓDIGO CIVIL PARA EL ESTADO DE GUANAJUATO SUBIDO A RAG.txt'),
        path.join(home, 'Desktop', 'CODIGO CIVIL PARA EL ESTADO DE GUANAJUATO SUBIDO A RAG.txt'),
        path.join(home, 'Desktop', 'Código Civil para el Estado de Guanajuato.txt'),
        path.join(process.cwd(), 'cc_gto.txt')
      ];
      for (const p of candidatesCC) {
        if (fs.existsSync(p)) { ccPath = p; break; }
      }
    }
    if (!cpcPath) {
      const home = os.homedir();
      const candidates = [
        path.join(home, 'Desktop', 'Código de Procedimientos Civiles subido a RAG.txt'),
        path.join(home, 'Desktop', 'Codigo de Procedimientos Civiles subido a RAG.txt'),
        path.join(process.cwd(), 'cpc_gto.txt')
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) { cpcPath = p; break; }
      }
    }
    let total = 0;
    if (ccPath && fs.existsSync(path.resolve(ccPath))) {
      const buf = fs.readFileSync(path.resolve(ccPath));
      let raw = buf.toString('utf8');
      if (/Ã|�/.test(raw)) raw = buf.toString('latin1');
      const parts = splitArticles(raw);
      const n = await upsertBatch(stateId, 'CC', parts);
      process.stdout.write(`CC: ${n} artículos.\n`);
      total += n;
    }
    if (cpcPath && fs.existsSync(path.resolve(cpcPath))) {
      const buf = fs.readFileSync(path.resolve(cpcPath));
      let raw = buf.toString('utf8');
      if (/Ã|�/.test(raw)) raw = buf.toString('latin1');
      const parts = splitArticles(raw);
      const n = await upsertBatch(stateId, 'CPC', parts);
      process.stdout.write(`CPC: ${n} artículos.\n`);
      total += n;
    }
    if (total === 0) {
      process.stderr.write('No se proporcionaron archivos válidos. Use --cc=path y/o --cpc=path o variables SEED_CC_FILE/SEED_CPC_FILE.\n');
      process.exit(1);
    }
    process.stdout.write(`Total insertados/actualizados: ${total}\n`);
  } catch (e: any) {
    process.stderr.write(String(e?.message || e) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
