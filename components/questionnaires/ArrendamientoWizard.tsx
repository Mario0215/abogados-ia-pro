import React from 'react';
import { useRouter } from 'next/router';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArrendamientoAnswers = {
  questionnaireType: 'arrendamiento';
  tipoAccion: 'COBRO_RENTAS' | 'DESAHUCIO' | 'RESCISION' | 'TERMINACION' | '';
  // Inmueble
  tipoInmueble: 'HABITACIONAL' | 'COMERCIAL' | '';
  descripcionInmueble: string;
  // Contrato
  fechaContrato: string;
  fechaInicio: string;
  duracionContrato: string;
  montoRentaMensual: string;
  depositoGarantia: string;
  tieneContrato: boolean | null;
  // Adeudo / Incumplimiento
  mesesAdeudados: string;
  periodoAdeudo: string;
  montoTotalAdeudo: string;
  // Para desahucio/rescisión
  causaRescision: string;
  // Notificación previa
  notificacionPrevia: boolean | null;
  fechaNotificacion: string;
  // Hechos
  hechosNarrativos: string;
  completedAt?: string;
};

const EMPTY: ArrendamientoAnswers = {
  questionnaireType: 'arrendamiento',
  tipoAccion: '',
  tipoInmueble: '',
  descripcionInmueble: '',
  fechaContrato: '',
  fechaInicio: '',
  duracionContrato: '',
  montoRentaMensual: '',
  depositoGarantia: '',
  tieneContrato: null,
  mesesAdeudados: '',
  periodoAdeudo: '',
  montoTotalAdeudo: '',
  causaRescision: '',
  notificacionPrevia: null,
  fechaNotificacion: '',
  hechosNarrativos: '',
};

type CheckItem = { text: string; ok: boolean };

function buildChecklist(a: ArrendamientoAnswers): CheckItem[] {
  const base: CheckItem[] = [
    { text: 'Tipo de acción definida', ok: !!a.tipoAccion },
    { text: 'Tipo de inmueble', ok: !!a.tipoInmueble },
    { text: 'Descripción del inmueble', ok: a.descripcionInmueble.trim().length >= 10 },
    { text: 'Monto de renta mensual', ok: !!a.montoRentaMensual },
    { text: 'Hechos narrados (mín. 80 caracteres)', ok: a.hechosNarrativos.trim().length >= 80 },
  ];
  if (a.tipoAccion === 'COBRO_RENTAS') {
    base.push({ text: 'Meses adeudados especificados', ok: !!a.mesesAdeudados });
    base.push({ text: 'Monto total del adeudo', ok: !!a.montoTotalAdeudo });
  }
  if (a.tipoAccion === 'RESCISION' || a.tipoAccion === 'DESAHUCIO') {
    base.push({ text: 'Causa de rescisión / desahucio', ok: a.causaRescision.trim().length >= 10 });
  }
  return base;
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
  options: Array<{ key: T; label: string; desc?: string }>;
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

// ─── Main Component ────────────────────────────────────────────────────────────

type Props = { caseId: string; clientName: string; counterparty: string };

export default function ArrendamientoWizard({ caseId, clientName, counterparty }: Props) {
  const router = useRouter();
  const TOTAL_STEPS = 5;
  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState<ArrendamientoAnswers>({ ...EMPTY });
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saveMsg, setSaveMsg] = React.useState('');

  const inp: React.CSSProperties = { width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, fontFamily: 'Georgia, serif' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.8px' };
  const btnPrimary: React.CSSProperties = { background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/cases/questionnaire?caseId=${encodeURIComponent(caseId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.questionnaireType === 'arrendamiento') {
          setAnswers({ ...EMPTY, ...d.data });
          if (d.data.completedAt) setStep(TOTAL_STEPS);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  function update(partial: Partial<ArrendamientoAnswers>) {
    setAnswers(prev => ({ ...prev, ...partial }));
  }

  async function saveAnswers(data: ArrendamientoAnswers) {
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
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
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

  const stepLabels = ['Acción', 'Inmueble', 'Adeudo', 'Hechos', 'Revisión'];

  function renderStep() {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
        Cargando datos del expediente...
      </div>
    );

    /* ── PASO 1: Tipo de acción ── */
    if (step === 1) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Selecciona la acción que ejercerá {clientName || 'el arrendador'} contra {counterparty || 'el arrendatario'}.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { key: 'COBRO_RENTAS', icon: '💰', label: 'Cobro de rentas vencidas', desc: 'El inquilino debe mensualidades. Se reclama el monto adeudado más intereses.' },
            { key: 'DESAHUCIO', icon: '🚪', label: 'Desahucio (terminación)', desc: 'Se solicita la desocupación del inmueble por término del contrato o falta de pago.' },
            { key: 'RESCISION', icon: '⚖️', label: 'Rescisión de contrato', desc: 'Incumplimiento grave del arrendatario: subarrendamiento, daños, uso indebido.' },
            { key: 'TERMINACION', icon: '📄', label: 'Terminación anticipada', desc: 'Se pone fin al contrato antes del plazo pactado.' },
          ].map(opt => (
            <div key={opt.key} onClick={() => update({ tipoAccion: opt.key as any })} style={{
              background: answers.tipoAccion === opt.key ? 'rgba(201,168,76,0.07)' : '#0d1117',
              border: `2px solid ${answers.tipoAccion === opt.key ? '#c9a84c' : '#1e293b'}`,
              borderRadius: 12, padding: '18px 16px', cursor: 'pointer', transition: 'all 0.15s'
            }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 5 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.55 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
        <div>
          <label style={lbl}>Tipo de inmueble</label>
          <OptionGroup<'HABITACIONAL' | 'COMERCIAL'>
            options={[
              { key: 'HABITACIONAL', label: 'Casa / Departamento habitacional' },
              { key: 'COMERCIAL', label: 'Local comercial / Bodega' },
            ]}
            value={answers.tipoInmueble}
            onChange={v => update({ tipoInmueble: v })}
          />
        </div>
      </div>
    );

    /* ── PASO 2: Datos del inmueble y contrato ── */
    if (step === 2) return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label style={lbl}>Descripción y dirección del inmueble</label>
          <textarea style={{ ...inp, height: 80, resize: 'vertical' }}
            placeholder="Ej: Casa habitación ubicada en Calle Álvaro Obregón #342, Col. Centro, León, Guanajuato, con superficie aproximada de 120 m²"
            value={answers.descripcionInmueble}
            onChange={e => update({ descripcionInmueble: e.target.value })}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Fecha del contrato de arrendamiento</label>
            <input type="date" style={inp} value={answers.fechaContrato} onChange={e => update({ fechaContrato: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Fecha de inicio de la ocupación</label>
            <input type="date" style={inp} value={answers.fechaInicio} onChange={e => update({ fechaInicio: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Duración pactada del contrato</label>
            <input style={inp} placeholder="Ej: 1 año / 6 meses / Indefinido" value={answers.duracionContrato} onChange={e => update({ duracionContrato: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Monto de renta mensual acordada</label>
            <input style={inp} placeholder="Ej: $5,000.00" value={answers.montoRentaMensual} onChange={e => update({ montoRentaMensual: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Depósito en garantía (si aplica)</label>
            <input style={inp} placeholder="Ej: $10,000.00 / No hubo" value={answers.depositoGarantia} onChange={e => update({ depositoGarantia: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>¿Se cuenta con contrato escrito?</label>
          <YesNo value={answers.tieneContrato} onChange={v => update({ tieneContrato: v })} />
        </div>
      </div>
    );

    /* ── PASO 3: Adeudo / incumplimiento ── */
    if (step === 3) return (
      <div style={{ display: 'grid', gap: 18 }}>
        {(answers.tipoAccion === 'COBRO_RENTAS' || answers.tipoAccion === 'DESAHUCIO') && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Número de mensualidades adeudadas</label>
                <input style={inp} placeholder="Ej: 3 meses" value={answers.mesesAdeudados} onChange={e => update({ mesesAdeudados: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Período del adeudo</label>
                <input style={inp} placeholder="Ej: enero-marzo 2025" value={answers.periodoAdeudo} onChange={e => update({ periodoAdeudo: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={lbl}>Monto total adeudado (rentas + accesorios)</label>
              <input style={inp} placeholder="Ej: $15,000.00" value={answers.montoTotalAdeudo} onChange={e => update({ montoTotalAdeudo: e.target.value })} />
            </div>
          </>
        )}
        {(answers.tipoAccion === 'RESCISION' || answers.tipoAccion === 'TERMINACION') && (
          <div>
            <label style={lbl}>Causa de rescisión / terminación</label>
            <textarea style={{ ...inp, height: 100, resize: 'vertical' }}
              placeholder="Ej: El arrendatario subarrendó el inmueble sin autorización, en violación a la cláusula quinta del contrato. Además, ha causado daños al inmueble..."
              value={answers.causaRescision}
              onChange={e => update({ causaRescision: e.target.value })}
            />
          </div>
        )}
        <div>
          <label style={lbl}>¿Se le notificó previamente al arrendatario sobre el incumplimiento?</label>
          <YesNo value={answers.notificacionPrevia} onChange={v => update({ notificacionPrevia: v })} />
          {answers.notificacionPrevia && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Fecha de la notificación</label>
              <input type="date" style={inp} value={answers.fechaNotificacion} onChange={e => update({ fechaNotificacion: e.target.value })} />
            </div>
          )}
        </div>
      </div>
    );

    /* ── PASO 4: Hechos narrativos ── */
    if (step === 4) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#c9a84c' }}>💡 Narración cronológica de los hechos.</strong><br />
          Incluya: fecha del contrato, inicio de la ocupación, cuándo empezaron los incumplimientos, gestiones previas para cobrar / recuperar el inmueble, y situación actual.
        </div>
        <div>
          <label style={lbl}>Narración de los hechos</label>
          <textarea
            style={{ ...inp, height: 220, resize: 'vertical', lineHeight: 1.75 }}
            placeholder="Ej: Con fecha [fecha], el suscrito celebró contrato de arrendamiento con el demandado respecto del inmueble ubicado en [dirección], por un monto mensual de $[cantidad]. A partir del mes de [mes/año], el demandado dejó de cubrir las mensualidades correspondientes, acumulando a la fecha [X] meses de adeudo por la cantidad total de $[total]..."
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

    /* ── PASO 5: Revisión ── */
    if (step === 5) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1e293b', background: '#111827' }}>
            Verificación del cuestionario — Arrendamiento
          </div>
          {checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < checklist.length - 1 ? '1px solid #111827' : 'none' }}>
              <span style={{ fontSize: 15, color: item.ok ? '#4ade80' : '#f87171', flexShrink: 0 }}>{item.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 13, color: item.ok ? '#cbd5e1' : '#94a3b8' }}>{item.text}</span>
            </div>
          ))}
        </div>

        {allOk ? (
          <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>Cuestionario completo</div>
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 2 }}>La IA tiene suficiente información para generar la demanda de arrendamiento.</div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Datos incompletos</div>
              <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>Puedes continuar — la IA marcará los datos faltantes como [COMPLETAR].</div>
            </div>
          </div>
        )}

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

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Case header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
          Demanda de Arrendamiento · {answers.tipoAccion
            ? ({ COBRO_RENTAS: 'Cobro de rentas', DESAHUCIO: 'Desahucio', RESCISION: 'Rescisión', TERMINACION: 'Terminación' } as Record<string,string>)[answers.tipoAccion]
            : 'Tipo por definir'}
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, color: '#f1f5f9' }}>
          {clientName || 'Arrendador'} <span style={{ color: '#334155', fontWeight: 400, fontSize: 15, margin: '0 8px' }}>vs.</span> {counterparty || 'Arrendatario'}
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
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
            Paso {step} de {TOTAL_STEPS}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
            {step === 1 && 'Tipo de acción y bien inmueble'}
            {step === 2 && 'Datos del contrato de arrendamiento'}
            {step === 3 && 'Situación del adeudo / incumplimiento'}
            {step === 4 && 'Narración de hechos'}
            {step === 5 && 'Revisión y validación'}
          </div>
        </div>

        {renderStep()}

        {step < TOTAL_STEPS && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
            <div>
              {step > 1 && <button onClick={goPrev} style={btnSecondary}>← Anterior</button>}
            </div>
            <button
              onClick={goNext}
              disabled={step === 1 && !answers.tipoAccion}
              style={{ ...btnPrimary, opacity: step === 1 && !answers.tipoAccion ? 0.45 : 1, cursor: step === 1 && !answers.tipoAccion ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Guardando...' : 'Siguiente →'}
            </button>
          </div>
        )}

        {step === TOTAL_STEPS && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
            <button onClick={goPrev} style={btnSecondary}>← Anterior</button>
          </div>
        )}
      </div>

      {(saveMsg || saving) && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: saveMsg ? '#4ade80' : '#64748b' }}>
          {saveMsg ? `✓ ${saveMsg}` : 'Guardando...'}
        </div>
      )}
    </div>
  );
}
