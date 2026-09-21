import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import AlimentosWizard from '../../../components/questionnaires/AlimentosWizard';
import ArrendamientoWizard from '../../../components/questionnaires/ArrendamientoWizard';
import UsucapionWizard from '../../../components/questionnaires/UsucapionWizard';

// ─── Types ────────────────────────────────────────────────────────────────────

type DivorceAnswers = {
  divorceType: 'MUTUO_ACUERDO' | 'CONTENCIOSO' | '';
  fechaMatrimonio: string;
  lugarMatrimonio: string;
  regimenPatrimonial: 'SOCIEDAD_CONYUGAL' | 'SEPARACION_BIENES' | '';
  tieneActaMatrimonio: boolean;
  tieneHijos: boolean | null;
  hijos: Array<{ nombre: string; edad: string }>;
  guardaCustodia: 'ACTOR' | 'DEMANDADO' | 'COMPARTIDA' | '';
  regimenVisitas: boolean;
  pensionHijos: boolean;
  montoPensionHijos: string;
  causal: string;
  descripcionCausal: string;
  tieneEvidencia: boolean | null;
  tipoEvidencia: string[];
  tienenBienes: boolean | null;
  descripcionBienes: string;
  divisionBienes: string;
  pensionConyuge: boolean;
  montoPensionConyuge: string;
  duracionPension: string;
  domicilioConyugal: 'ACTOR' | 'DEMANDADO' | 'OTRA' | '';
  hechosNarrativos: string;
  completedAt?: string;
};

const EMPTY: DivorceAnswers = {
  divorceType: '',
  fechaMatrimonio: '',
  lugarMatrimonio: '',
  regimenPatrimonial: '',
  tieneActaMatrimonio: false,
  tieneHijos: null,
  hijos: [],
  guardaCustodia: '',
  regimenVisitas: false,
  pensionHijos: false,
  montoPensionHijos: '',
  causal: '',
  descripcionCausal: '',
  tieneEvidencia: null,
  tipoEvidencia: [],
  tienenBienes: null,
  descripcionBienes: '',
  divisionBienes: '',
  pensionConyuge: false,
  montoPensionConyuge: '',
  duracionPension: '',
  domicilioConyugal: '',
  hechosNarrativos: '',
};

type CheckItem = { text: string; ok: boolean };

function buildChecklist(a: DivorceAnswers): CheckItem[] {
  const items: CheckItem[] = [
    { text: 'Tipo de divorcio definido', ok: !!a.divorceType },
    { text: 'Fecha de matrimonio', ok: !!a.fechaMatrimonio },
    { text: 'Lugar de matrimonio', ok: !!a.lugarMatrimonio },
    { text: 'Régimen patrimonial', ok: !!a.regimenPatrimonial },
    { text: 'Situación de hijos definida', ok: a.tieneHijos === false || (a.tieneHijos === true && a.hijos.length > 0 && a.hijos.every(h => h.nombre.trim())) },
    { text: 'Hechos narrados (mín. 80 caracteres)', ok: a.hechosNarrativos.trim().length >= 80 },
  ];
  if (a.divorceType === 'CONTENCIOSO') {
    items.push({ text: 'Causal de divorcio especificada', ok: !!a.causal });
    items.push({ text: 'Descripción de causal (mín. 50 chars)', ok: a.descripcionCausal.trim().length >= 50 });
  }
  if (a.divorceType === 'MUTUO_ACUERDO') {
    items.push({ text: 'Situación de bienes definida', ok: a.tienenBienes !== null });
    items.push({ text: 'Domicilio conyugal definido', ok: !!a.domicilioConyugal });
  }
  return items;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {([true, false] as const).map(v => (
        <button key={String(v)} onClick={() => onChange(v)} style={{
          padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: value === v ? (v ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.14)') : '#0d1117',
          border: `1px solid ${value === v ? (v ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.4)') : '#1e293b'}`,
          color: value === v ? (v ? '#4ade80' : '#f87171') : '#475569',
          transition: 'all 0.15s'
        }}>
          {v ? 'Sí' : 'No'}
        </button>
      ))}
    </div>
  );
}

function OptionGroup<T extends string>({ options, value, onChange }: {
  options: Array<{ key: T; label: string }>;
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt.key} onClick={() => onChange(opt.key)} style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: value === opt.key ? 'rgba(201,168,76,0.15)' : '#0d1117',
          border: `1px solid ${value === opt.key ? '#c9a84c' : '#1e293b'}`,
          color: value === opt.key ? '#c9a84c' : '#64748b',
          transition: 'all 0.15s'
        }}>{opt.label}</button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type QuestionnaireType = 'divorcio' | 'alimentos' | 'arrendamiento' | 'usucapion';
type Props = { caseId: string; clientName: string; counterparty: string; intent: string; questionnaireType: QuestionnaireType };

export default function PrepararPage({ caseId, clientName, counterparty, questionnaireType }: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState<number>(1);
  const [answers, setAnswers] = React.useState<DivorceAnswers>({ ...EMPTY });
  const [saving, setSaving] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  // ── Styles ──
  const inp: React.CSSProperties = { width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, fontFamily: 'Georgia, serif' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.8px' };
  const btnPrimary: React.CSSProperties = { background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

  // ── Load existing questionnaire ──
  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/cases/questionnaire?caseId=${encodeURIComponent(caseId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setAnswers({ ...EMPTY, ...d.data });
          if (d.data.completedAt) setStep(6);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  function update(partial: Partial<DivorceAnswers>) {
    setAnswers(prev => ({ ...prev, ...partial }));
  }

  async function saveAnswers(data: DivorceAnswers) {
    setSaving(true);
    try {
      await fetch('/api/cases/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, data })
      });
      setSaveMsg('Guardado');
      setTimeout(() => setSaveMsg(''), 1800);
    } catch { /* silent */ }
    setSaving(false);
  }

  async function goNext() {
    await saveAnswers(answers);
    setStep(s => Math.min(s + 1, 6));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function goPrev() {
    await saveAnswers(answers);
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function finish() {
    const done = { ...answers, completedAt: new Date().toISOString() };
    setAnswers(done);
    await saveAnswers(done);
    router.push(`/demandas/${encodeURIComponent(caseId)}/editor`);
  }

  const checklist = buildChecklist(answers);
  const allOk = checklist.every(c => c.ok);

  const stepLabels = ['Tipo', 'Matrimonio', 'Hijos', answers.divorceType === 'CONTENCIOSO' ? 'Causal' : 'Convenio', 'Hechos', 'Revisión'];

  // ── Step renders ──

  function renderStep() {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
        Cargando datos del expediente...
      </div>
    );

    /* ── PASO 1: Tipo de divorcio ── */
    if (step === 1) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Selecciona el tipo de divorcio para configurar el cuestionario de manera específica.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { key: 'MUTUO_ACUERDO', icon: '🤝', label: 'Mutuo Acuerdo', desc: 'Ambas partes de acuerdo. Se tramita con convenio regulador. Proceso más rápido.' },
            { key: 'CONTENCIOSO', icon: '⚖️', label: 'Contencioso / Necesario', desc: 'Una parte no está de acuerdo o existe una causal específica en el Código Civil.' }
          ].map(opt => (
            <div key={opt.key} onClick={() => update({ divorceType: opt.key as any })} style={{
              background: answers.divorceType === opt.key ? 'rgba(201,168,76,0.07)' : '#0d1117',
              border: `2px solid ${answers.divorceType === opt.key ? '#c9a84c' : '#1e293b'}`,
              borderRadius: 12, padding: '20px 18px', cursor: 'pointer', transition: 'all 0.15s'
            }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{opt.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );

    /* ── PASO 2: Datos del matrimonio ── */
    if (step === 2) return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Fecha de celebración del matrimonio</label>
            <input type="date" style={inp} value={answers.fechaMatrimonio} onChange={e => update({ fechaMatrimonio: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Municipio / Ciudad donde se celebró</label>
            <input style={inp} placeholder="Ej: León, Guanajuato" value={answers.lugarMatrimonio} onChange={e => update({ lugarMatrimonio: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>Régimen patrimonial del matrimonio</label>
          <select style={{ ...inp, padding: '10px 12px' }} value={answers.regimenPatrimonial} onChange={e => update({ regimenPatrimonial: e.target.value as any })}>
            <option value="">— Seleccionar —</option>
            <option value="SOCIEDAD_CONYUGAL">Sociedad conyugal</option>
            <option value="SEPARACION_BIENES">Separación de bienes</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={answers.tieneActaMatrimonio} onChange={e => update({ tieneActaMatrimonio: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#c9a84c' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Tienen acta de matrimonio disponible para adjuntar</span>
        </label>
      </div>
    );

    /* ── PASO 3: Hijos ── */
    if (step === 3) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={lbl}>¿Tienen hijos menores de edad?</label>
          <YesNo value={answers.tieneHijos} onChange={v => update({ tieneHijos: v, hijos: v && answers.hijos.length === 0 ? [{ nombre: '', edad: '' }] : answers.hijos })} />
        </div>

        {answers.tieneHijos === true && (
          <>
            <div>
              <label style={lbl}>Datos de los hijos menores</label>
              {answers.hijos.map((h, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <input style={inp} placeholder={`Nombre del hijo ${i + 1}`} value={h.nombre} onChange={e => {
                    const hijos = [...answers.hijos]; hijos[i] = { ...hijos[i], nombre: e.target.value }; update({ hijos });
                  }} />
                  <input style={inp} placeholder="Edad (años)" value={h.edad} onChange={e => {
                    const hijos = [...answers.hijos]; hijos[i] = { ...hijos[i], edad: e.target.value }; update({ hijos });
                  }} />
                  <button onClick={() => update({ hijos: answers.hijos.filter((_, j) => j !== i) })} style={{ ...btnSecondary, padding: '10px 14px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: 14 }}>✕</button>
                </div>
              ))}
              <button onClick={() => update({ hijos: [...answers.hijos, { nombre: '', edad: '' }] })} style={{ ...btnSecondary, fontSize: 12, padding: '7px 14px', marginTop: 4 }}>
                + Agregar hijo
              </button>
            </div>
            <div>
              <label style={lbl}>¿Quién tendrá la guarda y custodia?</label>
              <OptionGroup<'ACTOR' | 'DEMANDADO' | 'COMPARTIDA'>
                options={[
                  { key: 'ACTOR', label: clientName || 'El actor (demandante)' },
                  { key: 'DEMANDADO', label: counterparty || 'El demandado' },
                  { key: 'COMPARTIDA', label: 'Custodia compartida' }
                ]}
                value={answers.guardaCustodia}
                onChange={v => update({ guardaCustodia: v })}
              />
            </div>
            <div>
              <label style={lbl}>¿Habrá régimen de visitas para el otro progenitor?</label>
              <YesNo value={answers.regimenVisitas} onChange={v => update({ regimenVisitas: v })} />
            </div>
            <div>
              <label style={lbl}>¿Habrá pensión alimenticia para los hijos?</label>
              <YesNo value={answers.pensionHijos} onChange={v => update({ pensionHijos: v })} />
              {answers.pensionHijos && (
                <input style={{ ...inp, marginTop: 10 }} placeholder="Monto mensual acordado (Ej: $3,500.00)" value={answers.montoPensionHijos} onChange={e => update({ montoPensionHijos: e.target.value })} />
              )}
            </div>
          </>
        )}
        {answers.tieneHijos === false && (
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#475569' }}>
            Sin hijos menores de edad. Se continúa con los datos del convenio.
          </div>
        )}
      </div>
    );

    /* ── PASO 4A: Convenio regulador (mutuo acuerdo) ── */
    if (step === 4 && answers.divorceType === 'MUTUO_ACUERDO') return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={lbl}>¿Tienen bienes en común (inmuebles, vehículos, cuentas bancarias)?</label>
          <YesNo value={answers.tienenBienes} onChange={v => update({ tienenBienes: v })} />
        </div>
        {answers.tienenBienes === true && (
          <>
            <div>
              <label style={lbl}>Descripción de los bienes comunes</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} placeholder="Ej: Casa en Calle Juárez #45, León Gto.; Vehículo Honda Civic 2020 placas ABC-123; Cuenta BBVA..." value={answers.descripcionBienes} onChange={e => update({ descripcionBienes: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>¿Cómo se dividirán los bienes?</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} placeholder="Ej: La casa corresponderá al actor. El vehículo al demandado. Las cuentas se dividirán en partes iguales." value={answers.divisionBienes} onChange={e => update({ divisionBienes: e.target.value })} />
            </div>
          </>
        )}
        <div>
          <label style={lbl}>¿Habrá pensión alimenticia entre cónyuges?</label>
          <YesNo value={answers.pensionConyuge} onChange={v => update({ pensionConyuge: v })} />
          {answers.pensionConyuge && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <input style={inp} placeholder="Monto mensual (Ej: $5,000.00)" value={answers.montoPensionConyuge} onChange={e => update({ montoPensionConyuge: e.target.value })} />
              <input style={inp} placeholder="Duración (Ej: 2 años / indefinida)" value={answers.duracionPension} onChange={e => update({ duracionPension: e.target.value })} />
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>¿Quién se queda con el domicilio conyugal?</label>
          <OptionGroup<'ACTOR' | 'DEMANDADO' | 'OTRA'>
            options={[
              { key: 'ACTOR', label: clientName || 'El actor' },
              { key: 'DEMANDADO', label: counterparty || 'El demandado' },
              { key: 'OTRA', label: 'Se vende / Otro acuerdo' }
            ]}
            value={answers.domicilioConyugal}
            onChange={v => update({ domicilioConyugal: v })}
          />
        </div>
      </div>
    );

    /* ── PASO 4B: Causal (contencioso) ── */
    if (step === 4 && answers.divorceType === 'CONTENCIOSO') return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={lbl}>Causal de divorcio (Código Civil del Estado de Guanajuato)</label>
          <select style={{ ...inp, padding: '10px 12px' }} value={answers.causal} onChange={e => update({ causal: e.target.value })}>
            <option value="">— Seleccionar causal —</option>
            <option value="Abandono del hogar conyugal por más de seis meses">Abandono del hogar conyugal (más de 6 meses)</option>
            <option value="Violencia familiar">Violencia familiar</option>
            <option value="Adulterio comprobado de uno de los cónyuges">Adulterio comprobado</option>
            <option value="Sevicia, amenazas o injurias graves de un cónyuge para el otro">Sevicia, amenazas o injurias graves</option>
            <option value="Separación de hecho de los cónyuges por más de dos años">Separación de hecho (más de 2 años)</option>
            <option value="Negativa injustificada de contribuir a las cargas del matrimonio">Negativa a contribuir a las cargas del matrimonio</option>
            <option value="Conductas que hacen imposible la vida en común">Conductas que hacen imposible la vida en común</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Descripción detallada de los hechos de la causal</label>
          <textarea style={{ ...inp, height: 130, resize: 'vertical', lineHeight: 1.7 }} placeholder="Describa con precisión: fechas, lugares, circunstancias y consecuencias de los hechos que configuran la causal..." value={answers.descripcionCausal} onChange={e => update({ descripcionCausal: e.target.value })} />
          <div style={{ fontSize: 11, color: answers.descripcionCausal.length >= 50 ? '#4ade80' : '#475569', marginTop: 5 }}>
            {answers.descripcionCausal.length} / 50 caracteres mínimos recomendados
          </div>
        </div>
        <div>
          <label style={lbl}>¿Existe evidencia de la causal?</label>
          <YesNo value={answers.tieneEvidencia} onChange={v => update({ tieneEvidencia: v })} />
          {answers.tieneEvidencia === true && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>Selecciona los tipos de evidencia disponibles:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Actas levantadas', 'Testimonios de testigos', 'Fotografías o videos', 'Denuncia ante MP', 'Historial médico', 'Documentos escritos', 'Mensajes / comunicaciones'].map(tipo => {
                  const active = answers.tipoEvidencia.includes(tipo);
                  return (
                    <button key={tipo} onClick={() => update({ tipoEvidencia: active ? answers.tipoEvidencia.filter(t => t !== tipo) : [...answers.tipoEvidencia, tipo] })} style={{
                      padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: active ? 'rgba(59,130,246,0.15)' : '#0d1117',
                      border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : '#1e293b'}`,
                      color: active ? '#60a5fa' : '#64748b', transition: 'all 0.15s'
                    }}>{tipo}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );

    /* Fallback for step 4 when no type selected */
    if (step === 4) return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 13 }}>
        Regresa al Paso 1 y selecciona el tipo de divorcio para continuar.
      </div>
    );

    /* ── PASO 5: Hechos narrativos ── */
    if (step === 5) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#c9a84c' }}>💡 Esta narración alimenta la sección HECHOS de la demanda.</strong><br />
          Sea específico: incluya fechas, domicilios, nombres de las personas involucradas y circunstancias relevantes. Cuanto más detallado, mejor será el resultado de la IA.
        </div>
        <div>
          <label style={lbl}>Narración de los hechos</label>
          <textarea
            style={{ ...inp, height: 220, resize: 'vertical', lineHeight: 1.75 }}
            placeholder={
              answers.divorceType === 'CONTENCIOSO'
                ? 'Ej: El día XX de XX de XXXX, el demandado/la demandada abandonó el domicilio conyugal ubicado en [dirección completa], sin causa justificada y sin regresar a la fecha. Durante este período, el suscrito/la suscrita ha tenido que hacer frente a los gastos del hogar de manera unilateral...'
                : 'Ej: Los cónyuges contrajeron matrimonio el [fecha] y de común acuerdo han determinado que la relación matrimonial se encuentra irreparablemente deteriorada. Ambas partes, con plena libertad y conciencia, han decidido disolver el vínculo matrimonial de mutuo consentimiento...'
            }
            value={answers.hechosNarrativos}
            onChange={e => update({ hechosNarrativos: e.target.value })}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <div style={{ fontSize: 11, color: answers.hechosNarrativos.length >= 80 ? '#4ade80' : '#475569' }}>
              {answers.hechosNarrativos.length} caracteres {answers.hechosNarrativos.length < 80 ? '— recomendado mínimo 80' : '✓'}
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              {answers.hechosNarrativos.trim().split(/\s+/).filter(Boolean).length} palabras
            </div>
          </div>
        </div>
      </div>
    );

    /* ── PASO 6: Revisión y validación ── */
    if (step === 6) return (
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Checklist */}
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1e293b', background: '#111827' }}>
            Verificación de datos del cuestionario
          </div>
          {checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < checklist.length - 1 ? '1px solid #111827' : 'none' }}>
              <span style={{ fontSize: 15, color: item.ok ? '#4ade80' : '#f87171', flexShrink: 0 }}>{item.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 13, color: item.ok ? '#cbd5e1' : '#94a3b8' }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Result banner */}
        {allOk ? (
          <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>Cuestionario completo</div>
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 2 }}>La IA tiene suficiente información para generar una demanda precisa y completa.</div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Datos incompletos</div>
              <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>Puedes continuar al editor — la IA marcará los datos faltantes como [COMPLETAR].</div>
            </div>
          </div>
        )}

        {/* CTA: Ir al editor */}
        <button onClick={finish} style={{
          background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 10,
          padding: '15px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          ✨ Ir al Editor y Generar Demanda
        </button>

        <button onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }} style={{ ...btnSecondary, fontSize: 12, padding: '8px 16px', alignSelf: 'flex-start' }}>
          Modificar respuestas
        </button>
      </div>
    );

    return null;
  }

  // ── Render ──

  return (
    <>
      <Head><title>Preparar Demanda – Abogados IA</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0f1a; font-family: Georgia, serif; color: #e2e8f0; }
        select, input, textarea { color-scheme: dark; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0a0f1a' }}>

        {/* Topbar */}
        <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#c9a84c' }}>Abogados IA</span>
            <span style={{ color: '#1e293b', fontSize: 16 }}>›</span>
            <Link href="/mis-casos" style={{ fontSize: 12, color: '#475569', textDecoration: 'none' }}>Mis Casos</Link>
            <span style={{ color: '#1e293b', fontSize: 16 }}>›</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{clientName || 'Expediente'}</span>
            <span style={{ color: '#1e293b', fontSize: 16 }}>›</span>
            <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>Preparar Demanda</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saveMsg && <span style={{ fontSize: 11, color: '#4ade80' }}>✓ {saveMsg}</span>}
            {saving && <span style={{ fontSize: 11, color: '#64748b' }}>Guardando...</span>}
            <Link href={`/mis-casos/${encodeURIComponent(caseId)}`} style={{ background: 'transparent', border: '1px solid #1e293b', borderRadius: 7, padding: '6px 12px', color: '#64748b', fontSize: 12, textDecoration: 'none' }}>← Expediente</Link>
            <Link href={`/demandas/${encodeURIComponent(caseId)}/editor`} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 7, padding: '6px 12px', color: '#c9a84c', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
              Ir al Editor →
            </Link>
          </div>
        </div>

        {/* Content — Non-divorce wizards */}
        {questionnaireType === 'alimentos' && <AlimentosWizard caseId={caseId} clientName={clientName} counterparty={counterparty} />}
        {questionnaireType === 'arrendamiento' && <ArrendamientoWizard caseId={caseId} clientName={clientName} counterparty={counterparty} />}
        {questionnaireType === 'usucapion' && <UsucapionWizard caseId={caseId} clientName={clientName} counterparty={counterparty} />}

        {/* Content — Divorce wizard */}
        {questionnaireType === 'divorcio' && <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>

          {/* Case header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
              Demanda de Divorcio · {answers.divorceType === 'MUTUO_ACUERDO' ? 'Mutuo Acuerdo' : answers.divorceType === 'CONTENCIOSO' ? 'Contencioso' : 'Tipo por definir'}
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, color: '#f1f5f9' }}>
              {clientName || 'Actor'} <span style={{ color: '#334155', fontWeight: 400, fontSize: 15, margin: '0 8px' }}>vs.</span> {counterparty || 'Demandado'}
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 30 }}>
            {stepLabels.map((lbl2, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 3, borderRadius: 2, background: done ? '#c9a84c' : active ? 'rgba(201,168,76,0.45)' : '#1e293b', marginBottom: 5, transition: 'background 0.3s' }} />
                  <div style={{ fontSize: 10, color: done || active ? '#c9a84c' : '#334155', fontWeight: done || active ? 700 : 400 }}>{lbl2}</div>
                </div>
              );
            })}
          </div>

          {/* Step card */}
          <div key={step} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 14, padding: '26px 28px', animation: 'fadeIn 0.2s ease' }}>

            {/* Step title */}
            <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontSize: 11, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
                Paso {step} de 6
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
                {step === 1 && 'Tipo de divorcio'}
                {step === 2 && 'Datos del matrimonio'}
                {step === 3 && 'Situación familiar — hijos'}
                {step === 4 && (answers.divorceType === 'CONTENCIOSO' ? 'Causal de divorcio' : 'Convenio regulador')}
                {step === 5 && 'Narración de hechos'}
                {step === 6 && 'Revisión y validación'}
              </div>
            </div>

            {/* Step content */}
            {renderStep()}

            {/* Navigation */}
            {step < 6 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
                <div>
                  {step > 1 && <button onClick={goPrev} style={btnSecondary}>← Anterior</button>}
                </div>
                <button
                  onClick={goNext}
                  disabled={step === 1 && !answers.divorceType}
                  style={{ ...btnPrimary, opacity: step === 1 && !answers.divorceType ? 0.45 : 1, cursor: step === 1 && !answers.divorceType ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Guardando...' : 'Siguiente →'}
                </button>
              </div>
            )}

            {step === 6 && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
                <button onClick={goPrev} style={btnSecondary}>← Anterior</button>
              </div>
            )}
          </div>
        </div>}

      </div>
    </>
  );
}

// ─── SSR ──────────────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') return { redirect: { destination: '/login', permanent: false } };

  const caseId = String(params?.caseId || '');
  if (!caseId) return { notFound: true };

  const lc = await prisma.legalCase.findUnique({ where: { id: caseId }, include: { client: true } });
  if (!lc) return { notFound: true };
  if (!canAccessLegalCase(auth, lc)) return { notFound: true };

  const intentLower = (lc.intent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function detectType(i: string): QuestionnaireType | null {
    if (i.includes('divorcio') || i.includes('divorce')) return 'divorcio';
    if (i.includes('alimento') || i.includes('pension') || i.includes('pensión')) return 'alimentos';
    if (i.includes('arrendamiento') || i.includes('arrendatario') || i.includes('renta') || i.includes('inquilino')) return 'arrendamiento';
    if (i.includes('usucapion') || i.includes('prescripcion') || i.includes('adquisitiva')) return 'usucapion';
    return null;
  }

  const questionnaireType = detectType(intentLower);
  if (!questionnaireType) {
    return { redirect: { destination: `/demandas/${caseId}/editor`, permanent: false } };
  }

  return {
    props: {
      caseId,
      clientName: lc.client?.name || '',
      counterparty: lc.counterparty || '',
      intent: lc.intent || '',
      questionnaireType
    }
  };
};
