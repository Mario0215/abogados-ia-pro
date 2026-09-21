import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useEffect, useRef, useState } from 'react';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { useRouter } from 'next/router';

type KnowledgeItem = { id: string; title: string; snippet?: string | null; sourceType?: string | null; score?: number | null };
type TemplateItem = { id: string; title: string; content?: string };
type Props = { caseId: string; initialText: string };

export default function EditorPage({ caseId, initialText }: Props) {
  const router = useRouter();
  const [text, setText] = useState<string>(initialText || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [showTplList, setShowTplList] = useState<boolean>(false);
  const [showTplMenu, setShowTplMenu] = useState<boolean>(false);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [msg, setMsg] = useState<string>('');
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [dirty, setDirty] = useState<boolean>(false);
  const [expReal, setExpReal] = useState<string>('');
  const [folioProv, setFolioProv] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [actorAddress, setActorAddress] = useState<string>('');
  const [entity, setEntity] = useState<string>('');
  const [pretension, setPretension] = useState<string>('');
  const [facts, setFacts] = useState<string>('');
  const [caseNotes, setCaseNotes] = useState<string>('');
  const [counterpartyAddress, setCounterpartyAddress] = useState<string>('');
  const [sidebarTab, setSidebarTab] = useState<'articulos'|'datos'>('articulos');
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1|2|3>(1);
  const [generating, setGenerating] = useState<boolean>(false);

  function showMsg(m: string, type: 'ok'|'err'|'info' = 'info') {
    setMsg(m); setMsgType(type);
    if (type !== 'err') setTimeout(() => setMsg(''), 4000);
  }

  const autoTemplateApplied = useRef(false);

  useEffect(() => {
    fetch(`/api/templates`)
      .then(r => r.json())
      .then(data => {
        const list = (data.templates || []).map((t: any) => ({ id: String(t.id), title: String(t.title) }));
        setTemplates(list);
        // Auto-insert if ?templateId is in URL and not yet applied
        const urlTemplateId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('templateId') : null;
        if (urlTemplateId && !autoTemplateApplied.current) {
          autoTemplateApplied.current = true;
          void onInsertTemplate(urlTemplateId);
        }
      })
      .catch(() => setTemplates([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!caseId) return;
    fetch(`/api/cases/${caseId}`)
      .then(r => r.json())
      .then(data => {
        const kn = (data?.case?.knowledge || []).map((k: any) => ({
          id: String(k.id),
          title: String(k.document?.title || ''),
          snippet: k.snippet ?? null,
          sourceType: k.sourceType ?? null,
          score: typeof k.score === 'number' ? Number(k.score) : null
        }));
        setKnowledge(kn);
        const er = String((data?.case as any)?.expedienteReal || '').trim();
        const fp = String((data?.case as any)?.folioProvisional || '').trim();
        setExpReal(er); setFolioProv(fp);
        const cl = (data?.case as any)?.client;
        if (cl) { setClientName(String(cl.name || '')); setActorAddress(String(cl.address || '')); }
        const cp = (data?.case as any)?.counterparty;
        if (cp) setCounterparty(String(cp));
        const cpa = (data?.case as any)?.counterpartyAddress;
        if (cpa) setCounterpartyAddress(String(cpa));
        // fallback: read from notes JSON if column is empty
        if (!cpa) {
          try {
            const n = String((data?.case as any)?.notes || '').trim();
            if (n) {
              const parsed = JSON.parse(n);
              if (parsed?.counterpartyAddress) setCounterpartyAddress(String(parsed.counterpartyAddress));
            }
          } catch {}
        }
        const ent = (data?.case as any)?.state;
        if (ent) setEntity(String(ent));
        const it = (data?.case as any)?.intent;
        if (it) setPretension(String(it));
        const fx = (data?.case as any)?.facts;
        if (fx) setFacts(String(fx));
        try {
          const n = String((data?.case as any)?.notes || '').trim();
          if (n) {
            const parsed = JSON.parse(n);
            const arr = Array.isArray(parsed?.lawyerNotes) ? parsed.lawyerNotes : [];
            setCaseNotes(arr.join('\n'));
          }
        } catch { /* ignore */ }
      })
      .catch(() => setKnowledge([]));
  }, [caseId]);

  function applyFolioPlaceholders(input: string): string {
    let out = String(input || '');
    if (expReal) {
      if (folioProv) out = out.split(folioProv).join(expReal);
      out = out.replace(/\[FOLIO_PROVISIONAL\]/g, expReal);
    } else if (folioProv) {
      out = out.replace(/\[FOLIO_PROVISIONAL\]/g, folioProv);
    }
    return out;
  }

  async function autoSaveDraft() {
    if (!caseId) return;
    const content = String(text || '').trim();
    if (!content) return;
    try {
      setSaving(true);
      const res = await fetch('/api/cases/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, text: applyFolioPlaceholders(content), concept: 'DEMANDA_BORRADOR' })
      });
      if (res.ok) setLastSavedAt(Date.now());
    } catch { /* silent */ } finally { setSaving(false); }
  }

  useEffect(() => {
    const t = setInterval(() => { void autoSaveDraft(); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, text, expReal, folioProv]);

  function replacePlaceholders(body: string): string {
    let out = String(body || '');
    const pairs: Array<[string, string]> = [
      ['ACTOR', clientName || '[COMPLETAR]'],
      ['DEMANDADO', counterparty || '[COMPLETAR]'],
      ['DOMICILIO_ACTOR', actorAddress || '[COMPLETAR]'],
      ['DOMICILIO_DEMANDADO', counterpartyAddress || '[COMPLETAR]'],
      ['ENTIDAD', entity || '[COMPLETAR]'],
      ['EXPEDIENTE', (expReal || folioProv) || '[COMPLETAR]'],
      ['PRETENSION', pretension || '[COMPLETAR]']
    ];
    for (const [key, value] of pairs) {
      const r1 = new RegExp(`\\[\\s*${key}\\s*\\]`, 'gi');
      const r2 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      out = out.replace(r1, value).replace(r2, value);
    }
    return out;
  }

  function insertFactsIntoTemplate(body: string): string {
    const base = String(body || '');
    const factsText = (facts && facts.trim().length > 0) ? facts.trim() : '';
    if (!factsText) return base;
    if (base.includes(factsText)) return base;
    const headerRegex = /(^|\n)\s*H[ÉE]CHOS\s*:?\s*(\n|$)/i;
    const m = base.match(headerRegex);
    if (m && m.index !== undefined) {
      const insertIdx = m.index + m[0].length;
      return base.slice(0, insertIdx) + `\n${factsText}\n\n` + base.slice(insertIdx);
    }
    return `${base}\n\nHECHOS:\n${factsText}\n`;
  }

  async function onInsertTemplate(overrideId?: string) {
    showMsg('');
    const id = overrideId || templateId;
    // When id is provided directly (URL param or click), skip the state-find check
    if (!id) { showMsg('Selecciona una plantilla para insertar', 'err'); return; }
    if (!overrideId) {
      const t = templates.find(t => t.id === id);
      if (!t) { showMsg('Selecciona una plantilla para insertar', 'err'); return; }
    }
    try {
      const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (r.ok && d?.template?.content) {
        const notasBlock = caseNotes ? `\n\nNOTAS DEL ABOGADO:\n${caseNotes}\n` : '';
        const fundamentos = (knowledge || []).slice(0, 3).map(k => `- ${k.title}`).join('\n');
        const fundamentosBlock = fundamentos ? `\n\nFUNDAMENTOS SUGERIDOS:\n${fundamentos}\n` : '';
        const cuerpo = String(d.template.content);
        const cuerpoConMarcadores = replacePlaceholders(cuerpo);
        const cuerpoConHechos = insertFactsIntoTemplate(cuerpoConMarcadores);
        const datosCaso = [
          clientName ? `ACTOR: ${clientName}` : '',
          counterparty ? `DEMANDADO: ${counterparty}` : '',
          actorAddress ? `DOMICILIO ACTOR: ${actorAddress}` : '',
          (expReal || folioProv) ? `EXPEDIENTE: ${expReal || folioProv}` : '',
          entity ? `ENTIDAD: ${entity}` : '',
          pretension ? `PRETENSIÓN: ${pretension}` : ''
        ].filter(Boolean).join('\n');
        const resumenDatos = datosCaso ? `\n\nDATOS DEL CASO:\n${datosCaso}\n` : '';
        const armado = applyFolioPlaceholders(`${cuerpoConHechos}${notasBlock}${fundamentosBlock}${resumenDatos}`);
        const replace = typeof window !== 'undefined'
          ? window.confirm('¿Reemplazar el contenido actual?\nAceptar = Reemplazar · Cancelar = Añadir al final')
          : true;
        setText(replace ? armado : (text ? `${text}\n\n${armado}` : armado));
        setDirty(true);
        showMsg('Plantilla insertada', 'ok');
      } else { showMsg('No se pudo obtener el contenido del formato', 'err'); }
    } catch { showMsg('No se pudo obtener el contenido del formato', 'err'); }
  }

  async function onInsertIntelligentTemplate() {
    showMsg('');
    try {
      const base = [
        'C. JUEZ DE LO CIVIL EN TURNO',
        'PRESENTE.',
        '',
        '[ACTOR], mayor de edad, mexicano(a), con domicilio para oír y recibir notificaciones en [DOMICILIO_ACTOR], ante Usted con el debido respeto comparezco y expongo:',
        '',
        'Que por medio del presente escrito y en la VÍA ORDINARIA CIVIL, con fundamento en el Código Civil y el Código de Procedimientos Civiles del Estado de [ENTIDAD], vengo a promover formal DEMANDA en contra de [DEMANDADO], con domicilio de emplazamiento en [DOMICILIO_DEMANDADO], reclamándole las siguientes:',
        '',
        'P R E S T A C I O N E S',
        '',
        'A). [PRETENSION]',
        'B). El pago de gastos y costas que se originen con motivo del presente juicio.',
        'C). [COMPLETAR]',
        '',
        'H E C H O S:',
        '',
        '1.-',
        '2.-',
        '3.-',
        '',
        'D E R E C H O:',
        '',
        'I.- [COMPLETAR]',
        'II.- [COMPLETAR]',
        '',
        'Por lo anteriormente expuesto y fundado, a Usted C. Juez atentamente solicito:',
        '',
        'P U N T O S   P E T I T O R I O S',
        '',
        'PRIMERO.- Tenerme por presentado en los términos del presente escrito, interponiendo formal demanda en la VÍA ORDINARIA CIVIL.',
        'SEGUNDO.- Ordenar el emplazamiento del demandado [DEMANDADO] en el domicilio señalado: [DOMICILIO_DEMANDADO].',
        'TERCERO.- En su oportunidad, previos los trámites de ley, dictar sentencia definitiva condenando al demandado a [PRETENSION].',
        'CUARTO.- Condenar al demandado al pago de gastos y costas del juicio.',
        '',
        'PROTESTO LO NECESARIO',
        '',
        '[ENTIDAD], al día de su presentación.',
        '',
        '[ACTOR]'
      ].join('\n');
      const cuerpoConMarcadores = replacePlaceholders(base);
      const cuerpoConHechos = insertFactsIntoTemplate(cuerpoConMarcadores);
      const fundamentos = (knowledge || []).slice(0, 3).map(k => `- ${k.title}`).join('\n');
      const fundamentosBlock = fundamentos ? `\n\nFUNDAMENTOS SUGERIDOS:\n${fundamentos}\n` : '';
      const notasBlock = caseNotes ? `\n\nNOTAS DEL ABOGADO:\n${caseNotes}\n` : '';
      const armado = applyFolioPlaceholders(`${cuerpoConHechos}${fundamentosBlock}${notasBlock}`);
      const replace = typeof window !== 'undefined'
        ? window.confirm('¿Reemplazar el contenido actual con la Plantilla Inteligente?\nAceptar = Reemplazar · Cancelar = Añadir al final')
        : true;
      setText(replace ? armado : (text ? `${text}\n\n${armado}` : armado));
      setDirty(true);
      showMsg('Plantilla Inteligente insertada', 'ok');
    } catch { showMsg('No se pudo generar la Plantilla Inteligente', 'err'); }
  }

  async function onGenerarConIA() {
    if (!caseId) return;
    setShowWizard(false);
    setGenerating(true);
    showMsg('Generando demanda con IA... esto puede tardar unos segundos', 'info');
    try {
      const res = await fetch('/api/redaccion/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        const replace = text.trim().length === 0 || (typeof window !== 'undefined'
          ? window.confirm('¿Reemplazar el contenido actual con la demanda generada?\nAceptar = Reemplazar · Cancelar = Añadir al final')
          : true);
        setText(replace ? data.text : `${text}\n\n${data.text}`);
        setDirty(true);
        showMsg('Demanda generada con IA. Revisa y ajusta antes de exportar.', 'ok');
      } else {
        if (res.status === 402) {
          showMsg('Pago pendiente: el caso está bloqueado hasta cubrir el anticipo.', 'err');
        } else {
          showMsg(data.error || 'No se pudo generar la demanda', 'err');
        }
      }
    } catch {
      showMsg('Error de red al generar la demanda', 'err');
    } finally {
      setGenerating(false);
    }
  }

  async function onRefinarConIA() {
    if (!caseId || !text.trim()) { showMsg('El editor está vacío', 'err'); return; }
    showMsg('Refinando texto con IA...', 'info');
    try {
      const res = await fetch('/api/redaccion/sugerir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, text })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        setText(data.text);
        setDirty(true);
        showMsg(`Texto refinado. ${data.removedCount ? `Se depuraron ${data.removedCount} párrafos fuera del tema.` : ''}`, 'ok');
      } else {
        showMsg(data.error || 'No se pudo refinar el texto', 'err');
      }
    } catch {
      showMsg('Error de red al refinar', 'err');
    }
  }

  async function onSaveToCase() {
    if (!caseId) { showMsg('Falta ID del caso', 'err'); return; }
    if (!text || text.trim().length === 0) { showMsg('El editor está vacío', 'err'); return; }
    try {
      const res = await fetch('/api/cases/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, text: applyFolioPlaceholders(text), concept: 'DEMANDA_BORRADOR' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { showMsg('Borrador guardado', 'ok'); setLastSavedAt(Date.now()); setDirty(false); }
      else showMsg(data.error || 'No se pudo guardar el borrador', 'err');
    } catch { showMsg('Error de red guardando el borrador', 'err'); }
  }

  async function onExportDocx() {
    if (!caseId) { showMsg('Falta ID del caso', 'err'); return; }
    if (!text || text.trim().length === 0) { showMsg('El editor está vacío', 'err'); return; }
    if (!clientName || !counterparty || !actorAddress || !pretension) {
      showMsg('Completa los datos mínimos antes de exportar', 'err'); return;
    }
    try {
      const res = await fetch('/api/cases/export-demanda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId, format: 'docx',
          text: applyFolioPlaceholders(text),
          meta: { clientName, counterparty, actorAddress, entity, pretension }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { showMsg('Exportada y anexada al expediente', 'ok'); router.push(`/mis-casos/${caseId}`); }
      else {
        if (res.status === 402) showMsg('Pago pendiente: el caso está bloqueado hasta cubrir el anticipo.', 'err');
        else showMsg(data.error || 'No se pudo exportar', 'err');
      }
    } catch { showMsg('Error de red exportando', 'err'); }
  }

  const SOURCE_COLOR: Record<string, string> = { CC: '#c9a84c', CPC: '#3b82f6', CNPCF: '#8b5cf6', DOC: '#64748b' };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  const dataFields = [
    { label: 'Actor (Demandante)', value: clientName, icon: '👤' },
    { label: 'Domicilio del Actor', value: actorAddress, icon: '🏠' },
    { label: 'Demandado', value: counterparty, icon: '⚖️' },
    { label: 'Dom. Emplazamiento', value: counterpartyAddress, icon: '📍' },
    { label: 'Pretensión', value: pretension, icon: '📝' },
    { label: 'Entidad Federativa', value: entity, icon: '🗺️' },
    { label: 'Expediente', value: expReal || folioProv, icon: '🗂️' },
  ];
  const missingFields = dataFields.filter(f => !f.value).length;

  return (
    <>
      <Head><title>Editor de Demanda – Abogados IA</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0f1a; font-family: 'Georgia', serif; color: #e2e8f0; }
        textarea:focus { outline: none; }
        textarea { caret-color: #c9a84c; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        .tpl-item:hover { background: #1e293b !important; }
        .nav-btn:hover { opacity: 0.85; }
        .action-btn:hover { filter: brightness(1.15); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1a', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>

          {/* Izquierda: breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#c9a84c', letterSpacing: '-0.3px', flexShrink: 0 }}>Abogados IA</div>
            <div style={{ color: '#1e293b', fontSize: 16, flexShrink: 0 }}>›</div>
            <div style={{ fontSize: 12, color: '#475569', flexShrink: 0 }}>Editor de Demanda</div>
            {(clientName || counterparty) && (
              <>
                <div style={{ color: '#1e293b', fontSize: 16, flexShrink: 0 }}>›</div>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clientName}{clientName && counterparty ? <span style={{ color: '#475569', margin: '0 4px' }}>vs.</span> : ''}{counterparty}
                </div>
              </>
            )}
          </div>

          {/* Derecha: acciones agrupadas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

            {/* Grupo 1: Plantillas */}
            <div style={{ position: 'relative' }}>
              <button className="action-btn"
                onClick={() => { setShowTplMenu(v => !v); setShowTplList(false); }}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 12px', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13 }}>📄</span> Plantillas <span style={{ fontSize: 9, color: '#475569' }}>▾</span>
              </button>
              {showTplMenu && (
                <div style={{ position: 'absolute', top: 38, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, width: 210, zIndex: 50, animation: 'fadeIn 0.15s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #334155' }}>Opciones de plantilla</div>
                  <div className="tpl-item" onClick={() => { setShowTplMenu(false); setShowTplList(true); }}
                    style={{ padding: '11px 14px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📂</span> Mis plantillas
                  </div>
                  <div className="tpl-item" onClick={() => { setShowTplMenu(false); void onInsertIntelligentTemplate(); }}
                    style={{ padding: '11px 14px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⚡</span> Plantilla Inteligente
                  </div>
                </div>
              )}
              {showTplList && (
                <div style={{ position: 'absolute', top: 38, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, width: 280, maxHeight: 320, overflowY: 'auto', zIndex: 50, animation: 'fadeIn 0.15s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div style={{ padding: '8px 14px', fontSize: 11, color: '#64748b', borderBottom: '1px solid #334155', textTransform: 'uppercase', letterSpacing: 1 }}>Selecciona una plantilla</div>
                  {templates.length === 0 ? (
                    <div style={{ padding: '20px 14px', fontSize: 13, color: '#64748b', textAlign: 'center' }}>Sin plantillas guardadas</div>
                  ) : templates.map(t => (
                    <div key={t.id} className="tpl-item"
                      onClick={() => { setTemplateId(t.id); setShowTplList(false); void onInsertTemplate(t.id); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1a2332' }}>
                      {t.title}
                    </div>
                  ))}
                  <div className="tpl-item" onClick={() => setShowTplList(false)}
                    style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                    Cerrar
                  </div>
                </div>
              )}
            </div>

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: '#1e293b' }} />

            {/* Grupo 2: IA */}
            <button className="action-btn" onClick={() => setShowWizard(true)} disabled={generating} style={{
              background: generating ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)', borderRadius: 7, padding: '6px 12px',
              color: generating ? '#6d5b9a' : '#a78bfa', fontSize: 12, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}>
              {generating ? <><span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Generando...</> : <><span>✨</span> Generar con IA</>}
            </button>

            <button className="action-btn" onClick={onRefinarConIA} disabled={generating} style={{
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)',
              borderRadius: 7, padding: '6px 12px', color: '#2dd4bf',
              fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5
            }}>
              <span>🔧</span> Refinar
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: '#1e293b' }} />

            {/* Grupo 3: Guardar / Exportar */}
            <button className="action-btn" onClick={onSaveToCase} style={{
              background: dirty ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${dirty ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
              borderRadius: 7, padding: '6px 12px',
              color: dirty ? '#f87171' : '#4ade80',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}>
              {saving ? '⏳' : dirty ? '●' : '✓'} {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
            </button>

            <button className="action-btn" onClick={onExportDocx} style={{
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 7, padding: '6px 12px', color: '#60a5fa',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}>
              <span>📥</span> Exportar Word
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: '#1e293b' }} />

            <Link href={`/mis-casos/${caseId}`} className="nav-btn" style={{
              background: 'transparent', border: '1px solid #1e293b',
              borderRadius: 7, padding: '6px 12px', color: '#64748b',
              fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5
            }}>
              ← Expediente
            </Link>
          </div>
        </div>

        {/* Barra de mensajes */}
        {msg && (
          <div style={{
            background: msgType === 'ok' ? 'rgba(34,197,94,0.08)' : msgType === 'err' ? 'rgba(239,68,68,0.08)' : 'rgba(201,168,76,0.06)',
            borderBottom: `1px solid ${msgType === 'ok' ? 'rgba(34,197,94,0.25)' : msgType === 'err' ? 'rgba(239,68,68,0.25)' : 'rgba(201,168,76,0.18)'}`,
            color: msgType === 'ok' ? '#4ade80' : msgType === 'err' ? '#f87171' : '#c9a84c',
            padding: '7px 20px', fontSize: 12, animation: 'fadeIn 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span>{msgType === 'ok' ? '✓' : msgType === 'err' ? '✕' : 'ℹ'}</span>
            {msg}
          </div>
        )}

        {/* Editor + Sidebar */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Área del documento */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0f1a', overflow: 'hidden' }}>

            {/* Sub-barra del editor */}
            <div style={{ background: '#0f172a', borderBottom: '1px solid #1a2332', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#334155' }}>
                <span>Demanda Civil Ordinaria</span>
                <span style={{ color: '#1e293b' }}>|</span>
                <span style={{ color: wordCount > 0 ? '#475569' : '#334155' }}>{wordCount.toLocaleString()} palabras</span>
                <span style={{ color: '#1e293b' }}>|</span>
                <span style={{ color: charCount > 0 ? '#475569' : '#334155' }}>{charCount.toLocaleString()} caracteres</span>
              </div>
              <div style={{ fontSize: 11, color: '#334155' }}>
                {lastSavedAt ? `Guardado ${new Date(lastSavedAt).toLocaleTimeString('es-MX')}` : saving ? 'Guardando...' : ''}
              </div>
            </div>

            {/* Paper document area */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  ref={editorRef}
                  value={text}
                  onChange={e => { setText(e.target.value); setDirty(true); }}
                  onBlur={() => { void autoSaveDraft(); }}
                  placeholder={'C. JUEZ DE LO CIVIL EN TURNO\nPRESENTE.\n\nUse "Generar con IA" para crear la demanda automáticamente,\no "Plantilla Inteligente" para empezar con un formato base.'}
                  style={{
                    flex: 1, minHeight: 'calc(100vh - 180px)',
                    background: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: 4,
                    padding: '40px 48px',
                    color: '#d1d5db',
                    fontSize: 14, lineHeight: 2.0, resize: 'none',
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sidebar derecha */}
          <div style={{ width: 290, background: '#0f172a', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              {(['articulos', 'datos'] as const).map(tab => (
                <button key={tab} onClick={() => setSidebarTab(tab)} style={{
                  flex: 1, padding: '11px 0', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1, border: 'none', cursor: 'pointer',
                  background: sidebarTab === tab ? 'rgba(201,168,76,0.06)' : 'transparent',
                  color: sidebarTab === tab ? '#c9a84c' : '#475569',
                  borderBottom: sidebarTab === tab ? '2px solid #c9a84c' : '2px solid transparent',
                  transition: 'all 0.15s'
                }}>
                  {tab === 'articulos' ? '📚 Artículos' : '📋 Datos'}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>

              {sidebarTab === 'articulos' && (
                <>
                  {knowledge.length > 0 && (
                    <div style={{ fontSize: 11, color: '#334155', padding: '4px 4px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {knowledge.length} artículos relevantes
                    </div>
                  )}
                  {knowledge.length === 0 ? (
                    <div style={{ padding: '32px 12px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                      Sin artículos sugeridos para este caso
                    </div>
                  ) : knowledge.map(k => (
                    <div key={k.id} style={{ background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', marginBottom: 7, animation: 'slideIn 0.2s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{
                          background: `${SOURCE_COLOR[k.sourceType || 'DOC']}18`,
                          color: SOURCE_COLOR[k.sourceType || 'DOC'],
                          border: `1px solid ${SOURCE_COLOR[k.sourceType || 'DOC']}35`,
                          borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 800, letterSpacing: 0.5
                        }}>
                          {k.sourceType || 'DOC'}
                        </span>
                        {k.score != null && (
                          <span style={{ fontSize: 10, color: '#334155', background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 4, padding: '1px 6px' }}>
                            {Math.round((k.score || 0) * 100)}%
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{k.title}</div>
                      {k.snippet && (
                        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, borderTop: '1px solid #1e293b', paddingTop: 6, marginTop: 4 }}>{String(k.snippet).slice(0, 160)}{k.snippet.length > 160 ? '…' : ''}</div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {sidebarTab === 'datos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {missingFields > 0 && (
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠</span> {missingFields} dato{missingFields > 1 ? 's' : ''} sin capturar
                    </div>
                  )}
                  {missingFields === 0 && (
                    <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✓</span> Todos los datos completos
                    </div>
                  )}
                  {dataFields.map(({ label, value, icon }) => (
                    <div key={label} style={{ background: '#0a0f1a', border: `1px solid ${value ? '#1e293b' : '#1a1a2e'}`, borderRadius: 8, padding: '9px 12px' }}>
                      <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>{icon}</span> {label}
                      </div>
                      <div style={{ fontSize: 12, color: value ? '#cbd5e1' : '#1e293b', fontStyle: value ? 'normal' : 'italic' }}>
                        {value || 'sin datos'}
                      </div>
                    </div>
                  ))}
                  {caseNotes && (
                    <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, padding: '9px 12px' }}>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>🗒️</span> Notas del Abogado
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{caseNotes}</div>
                    </div>
                  )}
                  <Link href={`/mis-casos/${caseId}`} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#64748b', textDecoration: 'none', textAlign: 'center', marginTop: 4 }}>
                    ✏️ Editar datos del expediente →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Generar con IA */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 14, padding: 28, width: 'min(580px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>✨ Generar Demanda con IA</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Paso {wizardStep} de 3</div>
              </div>
              <button onClick={() => { setShowWizard(false); setWizardStep(1); }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
              {[1,2,3].map(s => (
                <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: wizardStep >= s ? '#a78bfa' : '#1e293b' }} />
              ))}
            </div>

            {/* Paso 1: Confirmar datos */}
            {wizardStep === 1 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c9a84c', marginBottom: 14 }}>Paso 1 — Confirmar datos del caso</div>
                {[
                  { label: 'Actor (Demandante)', value: clientName, warn: !clientName },
                  { label: 'Domicilio del Actor', value: actorAddress, warn: !actorAddress },
                  { label: 'Demandado', value: counterparty, warn: !counterparty },
                  { label: 'Domicilio de Emplazamiento', value: counterpartyAddress, warn: !counterpartyAddress },
                  { label: 'Pretensión / Tipo de demanda', value: pretension, warn: !pretension },
                ].map(({ label, value, warn }) => (
                  <div key={label} style={{ background: '#0d1117', border: `1px solid ${warn ? 'rgba(239,68,68,0.4)' : '#1e293b'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: warn ? '#ef4444' : '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{label}{warn ? ' ⚠ FALTA' : ''}</div>
                    <div style={{ fontSize: 13, color: value ? '#e2e8f0' : '#475569' }}>{value || '— no capturado —'}</div>
                  </div>
                ))}
                {(!clientName || !counterparty || !counterpartyAddress) && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    Hay datos faltantes. La IA los marcará como [COMPLETAR]. Puedes continuar o regresar al expediente a completarlos.
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Revisar hechos */}
            {wizardStep === 2 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c9a84c', marginBottom: 14 }}>Paso 2 — Hechos del caso</div>
                {facts.trim() ? (
                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '14px', fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                    {facts}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '14px', fontSize: 13, color: '#ef4444' }}>
                    No hay hechos capturados. La IA generará la estructura pero la sección de hechos quedará en blanco. Puedes capturarlos en la pestaña &quot;Hechos&quot; del expediente antes de generar.
                  </div>
                )}
                {facts.trim() && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                    Estos hechos se inyectarán en la sección H E C H O S de la demanda.
                  </div>
                )}
              </div>
            )}

            {/* Paso 3: Confirmar y generar */}
            {wizardStep === 3 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c9a84c', marginBottom: 14 }}>Paso 3 — Listo para generar</div>
                <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: 16, fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                  <div>La IA redactará una demanda civil formal con:</div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      `Datos de las partes (actor: ${clientName || '[COMPLETAR]'})`,
                      `Domicilio de emplazamiento del demandado`,
                      `Prestaciones y puntos petitorios`,
                      `Hechos ${facts.trim() ? 'capturados ✓' : 'en blanco ⚠'}`,
                      `${knowledge.length} artículos legales del CC y CPC`,
                      `Notas del abogado ${caseNotes ? '✓' : '(sin notas)'}`,
                    ].map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#a78bfa', marginTop: 1 }}>•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 12, color: '#475569' }}>
                    El texto generado es un borrador. Revísalo y ajusta antes de exportar.
                  </div>
                </div>
              </div>
            )}

            {/* Botones de navegación */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              {wizardStep > 1 && (
                <button onClick={() => setWizardStep(s => (s - 1) as 1|2|3)} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 18px', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Anterior
                </button>
              )}
              {wizardStep < 3 && (
                <button onClick={() => setWizardStep(s => (s + 1) as 1|2|3)} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, padding: '9px 18px', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Siguiente →
                </button>
              )}
              {wizardStep === 3 && (
                <button onClick={onGenerarConIA} style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 8, padding: '9px 20px', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✨ Generar ahora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const caseId = String(params?.caseId || '');
  if (!caseId) return { notFound: true };
  const lc = await prisma.legalCase.findUnique({ where: { id: caseId }, select: { id: true, userId: true, abogadoId: true } });
  if (!canAccessLegalCase(auth, lc as any)) return { notFound: true };
  let initialText = '';
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ storagePath: string | null }>>(
      `SELECT "storagePath" FROM "CaseAttachment" WHERE "caseId" = $1 AND "concept" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
      caseId, 'DEMANDA_BORRADOR'
    );
    const sp = rows?.[0]?.storagePath || '';
    if (sp && /^https?:\/\//i.test(sp)) {
      const r = await fetch(sp);
      if (r.ok) initialText = await r.text();
    }
  } catch { /* ignore */ }
  return { props: { caseId, initialText } };
};
