import React from 'react';
import { useRouter } from 'next/router';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UsucapionAnswers = {
  questionnaireType: 'usucapion';
  tipoBien: 'INMUEBLE' | 'MUEBLE' | '';
  // Descripción del bien
  descripcionBien: string;
  ubicacionBien: string;
  superficieBien: string;
  claveCatastral: string;
  // Posesión
  fechaInicioPosesion: string;
  añosPosesion: string;
  formaAdquisicion: string;
  // Características de la posesión (Art. 826 CC Gto.)
  posesionPublica: boolean | null;
  posesionPacifica: boolean | null;
  posesionContinua: boolean | null;
  posesionTituloDueño: boolean | null;
  // Evidencia
  actosPosesorios: string;
  pagosPredial: boolean | null;
  realizoConstrucciones: boolean | null;
  descripcionMejoras: string;
  testigos: boolean | null;
  // Propietario registral
  propietarioRegistral: string;
  tituloPrevio: string;
  // Hechos
  hechosNarrativos: string;
  completedAt?: string;
};

const EMPTY: UsucapionAnswers = {
  questionnaireType: 'usucapion',
  tipoBien: '',
  descripcionBien: '',
  ubicacionBien: '',
  superficieBien: '',
  claveCatastral: '',
  fechaInicioPosesion: '',
  añosPosesion: '',
  formaAdquisicion: '',
  posesionPublica: null,
  posesionPacifica: null,
  posesionContinua: null,
  posesionTituloDueño: null,
  actosPosesorios: '',
  pagosPredial: null,
  realizoConstrucciones: null,
  descripcionMejoras: '',
  testigos: null,
  propietarioRegistral: '',
  tituloPrevio: '',
  hechosNarrativos: '',
};

type CheckItem = { text: string; ok: boolean };

function buildChecklist(a: UsucapionAnswers): CheckItem[] {
  return [
    { text: 'Tipo de bien definido', ok: !!a.tipoBien },
    { text: 'Descripción del bien', ok: a.descripcionBien.trim().length >= 10 },
    { text: 'Ubicación del bien', ok: !!a.ubicacionBien },
    { text: 'Fecha de inicio de posesión', ok: !!a.fechaInicioPosesion },
    { text: 'Forma de adquisición de la posesión', ok: a.formaAdquisicion.trim().length >= 5 },
    { text: 'Actos posesorios descritos', ok: a.actosPosesorios.trim().length >= 10 },
    { text: 'Características de la posesión contestadas', ok: a.posesionPublica !== null && a.posesionPacifica !== null && a.posesionContinua !== null && a.posesionTituloDueño !== null },
    { text: 'Hechos narrados (mín. 80 caracteres)', ok: a.hechosNarrativos.trim().length >= 80 },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YesNo({ value, onChange, labelYes = 'Sí', labelNo = 'No' }: { value: boolean | null; onChange: (v: boolean) => void; labelYes?: string; labelNo?: string }) {
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
          {v ? labelYes : labelNo}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type Props = { caseId: string; clientName: string; counterparty: string };

export default function UsucapionWizard({ caseId, clientName, counterparty }: Props) {
  const router = useRouter();
  const TOTAL_STEPS = 5;
  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState<UsucapionAnswers>({ ...EMPTY });
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
        if (d.data?.questionnaireType === 'usucapion') {
          setAnswers({ ...EMPTY, ...d.data });
          if (d.data.completedAt) setStep(TOTAL_STEPS);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  function update(partial: Partial<UsucapionAnswers>) {
    setAnswers(prev => ({ ...prev, ...partial }));
  }

  async function saveAnswers(data: UsucapionAnswers) {
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

  const stepLabels = ['Bien', 'Posesión', 'Evidencia', 'Hechos', 'Revisión'];

  function renderStep() {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
        Cargando datos del expediente...
      </div>
    );

    /* ── PASO 1: Descripción del bien ── */
    if (step === 1) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Describe con detalle el bien que el actor ({clientName || 'poseedor'}) pretende adquirir por prescripción adquisitiva.
        </p>
        <div>
          <label style={lbl}>Tipo de bien</label>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { key: 'INMUEBLE', icon: '🏠', label: 'Bien Inmueble', desc: 'Casa, terreno, departamento, local' },
              { key: 'MUEBLE', icon: '🚗', label: 'Bien Mueble', desc: 'Vehículo, maquinaria, equipo' },
            ].map(opt => (
              <div key={opt.key} onClick={() => update({ tipoBien: opt.key as any })} style={{
                flex: 1, background: answers.tipoBien === opt.key ? 'rgba(201,168,76,0.07)' : '#0d1117',
                border: `2px solid ${answers.tipoBien === opt.key ? '#c9a84c' : '#1e293b'}`,
                borderRadius: 12, padding: '18px 16px', cursor: 'pointer', transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{opt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Descripción del bien (características físicas, linderos, etc.)</label>
          <textarea style={{ ...inp, height: 90, resize: 'vertical' }}
            placeholder={answers.tipoBien === 'INMUEBLE'
              ? 'Ej: Predio rústico/urbano con superficie de 200 m², con las siguientes medidas y colindancias: al Norte 10m con propiedad de..., al Sur...'
              : 'Ej: Vehículo marca Toyota, modelo Corolla, año 2010, color blanco, motor serie...'}
            value={answers.descripcionBien}
            onChange={e => update({ descripcionBien: e.target.value })}
          />
        </div>
        <div>
          <label style={lbl}>Ubicación del bien</label>
          <input style={inp}
            placeholder="Ej: Calle Hidalgo s/n, Col. Lomas del Estadio, León, Guanajuato / Municipio de Silao, Gto."
            value={answers.ubicacionBien}
            onChange={e => update({ ubicacionBien: e.target.value })}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Superficie (si aplica)</label>
            <input style={inp} placeholder="Ej: 200 m² / 0.5 ha" value={answers.superficieBien} onChange={e => update({ superficieBien: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Clave catastral (si se conoce)</label>
            <input style={inp} placeholder="Ej: 12-34-5678 / Se desconoce" value={answers.claveCatastral} onChange={e => update({ claveCatastral: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>Propietario registral (nombre del titular en Registro Público)</label>
          <input style={inp}
            placeholder="Ej: Juan García López (demandado) / Desconocido / Sucesión de..."
            value={answers.propietarioRegistral}
            onChange={e => update({ propietarioRegistral: e.target.value })}
          />
        </div>
        <div>
          <label style={lbl}>Título con el que se posee (si existe algún documento)</label>
          <input style={inp}
            placeholder="Ej: Compraventa verbal / Cesión de derechos posesorios / Herencia de hecho / Sin título"
            value={answers.tituloPrevio}
            onChange={e => update({ tituloPrevio: e.target.value })}
          />
        </div>
      </div>
    );

    /* ── PASO 2: Historia y características de la posesión ── */
    if (step === 2) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#60a5fa' }}>Art. 826 CC Gto.</strong> — Para la prescripción adquisitiva la posesión debe ser: <strong>en concepto de dueño, pública, pacífica y continua</strong>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Fecha de inicio de la posesión</label>
            <input type="date" style={inp} value={answers.fechaInicioPosesion} onChange={e => update({ fechaInicioPosesion: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Años de posesión (aproximado)</label>
            <input style={inp} placeholder="Ej: 15 años / 5 años" value={answers.añosPosesion} onChange={e => update({ añosPosesion: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>¿Cómo adquirió la posesión del bien?</label>
          <input style={inp}
            placeholder="Ej: Compra verbal al anterior poseedor en 2008 / Me fue entregado por mi padre / Lo encontré abandonado y lo ocupé"
            value={answers.formaAdquisicion}
            onChange={e => update({ formaAdquisicion: e.target.value })}
          />
        </div>

        {/* Las 4 características */}
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            {
              key: 'posesionTituloDueño' as const,
              label: 'En concepto de dueño',
              hint: '¿Se porta el bien como si fuera propio, sin reconocer derecho ajeno sobre él?'
            },
            {
              key: 'posesionPublica' as const,
              label: 'Pública',
              hint: '¿La posesión es visible para todos, sin ocultarse ni ser clandestina?'
            },
            {
              key: 'posesionPacifica' as const,
              label: 'Pacífica',
              hint: '¿La posesión se adquirió y mantiene sin violencia ni intimidación?'
            },
            {
              key: 'posesionContinua' as const,
              label: 'Continua e ininterrumpida',
              hint: '¿Ha poseído el bien sin interrupciones desde el inicio?'
            },
          ].map(({ key, label, hint }) => (
            <div key={key} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>{hint}</div>
              <YesNo
                value={answers[key]}
                onChange={v => update({ [key]: v } as any)}
                labelYes="Sí, cumple"
                labelNo="No / Dudoso"
              />
            </div>
          ))}
        </div>
      </div>
    );

    /* ── PASO 3: Evidencia y actos posesorios ── */
    if (step === 3) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={lbl}>Actos posesorios realizados sobre el bien</label>
          <textarea style={{ ...inp, height: 100, resize: 'vertical' }}
            placeholder="Ej: Ha pagado el impuesto predial desde 2008, construyó una barda perimetral en 2010, realizó ampliación de la casa en 2015, tiene los servicios de agua y luz a su nombre desde 2009..."
            value={answers.actosPosesorios}
            onChange={e => update({ actosPosesorios: e.target.value })}
          />
        </div>
        <div>
          <label style={lbl}>¿Ha pagado impuesto predial del bien?</label>
          <YesNo value={answers.pagosPredial} onChange={v => update({ pagosPredial: v })} />
        </div>
        <div>
          <label style={lbl}>¿Ha realizado construcciones o mejoras en el bien?</label>
          <YesNo value={answers.realizoConstrucciones} onChange={v => update({ realizoConstrucciones: v })} />
          {answers.realizoConstrucciones && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Descripción de construcciones o mejoras</label>
              <input style={inp}
                placeholder="Ej: Barda perimetral de block (2010), cuarto adicional (2015), techado de patio (2018)"
                value={answers.descripcionMejoras}
                onChange={e => update({ descripcionMejoras: e.target.value })}
              />
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>¿Cuenta con testigos que acrediten la posesión?</label>
          <YesNo value={answers.testigos} onChange={v => update({ testigos: v })} />
        </div>
      </div>
    );

    /* ── PASO 4: Hechos narrativos ── */
    if (step === 4) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#c9a84c' }}>💡 Narración de la historia posesoria.</strong><br />
          Detalle: cómo adquirió la posesión, desde cuándo, qué actos ha realizado, por qué no tiene título de propiedad formal, y por qué procede la usucapión.
        </div>
        <div>
          <label style={lbl}>Narración de los hechos</label>
          <textarea
            style={{ ...inp, height: 240, resize: 'vertical', lineHeight: 1.75 }}
            placeholder="Ej: En el año [año], el suscrito adquirió la posesión del predio ubicado en [dirección] mediante [forma de adquisición]. Desde esa fecha y hasta la presente, el suscrito ha poseído dicho predio de forma pública, pacífica, continua y en concepto de propietario, habiendo realizado los siguientes actos posesorios: [actos]. No obstante lo anterior, el actor no cuenta con título formal de propiedad, por lo que acude ante este H. Juzgado a solicitar se declare la prescripción adquisitiva del bien..."
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
            Verificación del cuestionario — Prescripción Adquisitiva (Usucapión)
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
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 2 }}>La IA tiene suficiente información para generar la demanda de usucapión.</div>
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
          Demanda de Prescripción Adquisitiva (Usucapión)
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, color: '#f1f5f9' }}>
          {clientName || 'Poseedor'} <span style={{ color: '#334155', fontWeight: 400, fontSize: 15, margin: '0 8px' }}>vs.</span> {counterparty || 'Propietario registral'}
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
            {step === 1 && 'Descripción del bien a usucapir'}
            {step === 2 && 'Historia y características de la posesión'}
            {step === 3 && 'Actos posesorios y evidencia'}
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
              disabled={step === 1 && !answers.tipoBien}
              style={{ ...btnPrimary, opacity: step === 1 && !answers.tipoBien ? 0.45 : 1, cursor: step === 1 && !answers.tipoBien ? 'not-allowed' : 'pointer' }}
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
