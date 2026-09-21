import React from 'react';
import { useRouter } from 'next/router';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlimentosAnswers = {
  questionnaireType: 'alimentos';
  relacionPartes: 'MATRIMONIO' | 'CONCUBINATO' | 'FILIACION' | 'OTRO' | '';
  descripcionRelacion: string;
  // Acreedor (actor / cliente)
  ocupacionAcreedor: string;
  ingresosMensualesAcreedor: string;
  // Necesidades mensuales
  gastosAlimentacion: string;
  gastosMedicamentos: string;
  gastosVivienda: string;
  gastosEducacion: string;
  gastosTransporte: string;
  otrosGastos: string;
  totalNecesidades: string;
  // Deudor (demandado)
  ocupacionDeudor: string;
  patronDeudor: string;
  ingresosMensualesDeudor: string;
  tieneOtrosObligados: boolean | null;
  // Prestaciones
  montoPensionSolicitada: string;
  modalidadPago: 'DESCUENTO_NOMINA' | 'DEPOSITO' | 'EFECTIVO' | '';
  pensionProvisional: boolean;
  // Hechos
  hechosNarrativos: string;
  completedAt?: string;
};

const EMPTY: AlimentosAnswers = {
  questionnaireType: 'alimentos',
  relacionPartes: '',
  descripcionRelacion: '',
  ocupacionAcreedor: '',
  ingresosMensualesAcreedor: '',
  gastosAlimentacion: '',
  gastosMedicamentos: '',
  gastosVivienda: '',
  gastosEducacion: '',
  gastosTransporte: '',
  otrosGastos: '',
  totalNecesidades: '',
  ocupacionDeudor: '',
  patronDeudor: '',
  ingresosMensualesDeudor: '',
  tieneOtrosObligados: null,
  montoPensionSolicitada: '',
  modalidadPago: '',
  pensionProvisional: false,
  hechosNarrativos: '',
};

type CheckItem = { text: string; ok: boolean };

function buildChecklist(a: AlimentosAnswers): CheckItem[] {
  return [
    { text: 'Relación entre las partes definida', ok: !!a.relacionPartes },
    { text: 'Ocupación del acreedor alimentario', ok: !!a.ocupacionAcreedor },
    { text: 'Al menos un gasto mensual capturado', ok: !!(a.gastosAlimentacion || a.gastosVivienda || a.otrosGastos) },
    { text: 'Total de necesidades mensual', ok: !!a.totalNecesidades },
    { text: 'Ocupación o patrón del deudor', ok: !!(a.ocupacionDeudor || a.patronDeudor) },
    { text: 'Monto de pensión solicitada', ok: !!a.montoPensionSolicitada },
    { text: 'Modalidad de pago definida', ok: !!a.modalidadPago },
    { text: 'Hechos narrados (mín. 80 caracteres)', ok: a.hechosNarrativos.trim().length >= 80 },
  ];
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

// ─── Main Component ────────────────────────────────────────────────────────────

type Props = { caseId: string; clientName: string; counterparty: string };

export default function AlimentosWizard({ caseId, clientName, counterparty }: Props) {
  const router = useRouter();
  const TOTAL_STEPS = 5;
  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState<AlimentosAnswers>({ ...EMPTY });
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
        if (d.data?.questionnaireType === 'alimentos') {
          setAnswers({ ...EMPTY, ...d.data });
          if (d.data.completedAt) setStep(TOTAL_STEPS);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  function update(partial: Partial<AlimentosAnswers>) {
    setAnswers(prev => ({ ...prev, ...partial }));
  }

  // Auto-calculate total when any expense changes
  function updateGasto(field: keyof AlimentosAnswers, value: string) {
    setAnswers(prev => {
      const next = { ...prev, [field]: value };
      const nums = [next.gastosAlimentacion, next.gastosMedicamentos, next.gastosVivienda, next.gastosEducacion, next.gastosTransporte, next.otrosGastos]
        .map(v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0);
      const total = nums.reduce((a, b) => a + b, 0);
      return { ...next, totalNecesidades: total > 0 ? total.toFixed(2) : '' };
    });
  }

  async function saveAnswers(data: AlimentosAnswers) {
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

  const stepLabels = ['Relación', 'Necesidades', 'Deudor', 'Hechos', 'Revisión'];

  function renderStep() {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
        Cargando datos del expediente...
      </div>
    );

    /* ── PASO 1: Relación entre las partes ── */
    if (step === 1) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Define el vínculo jurídico que da origen a la obligación alimentaria del demandado hacia el acreedor ({clientName || 'cliente'}).
        </p>
        <div>
          <label style={lbl}>Relación entre las partes</label>
          <OptionGroup<'MATRIMONIO' | 'CONCUBINATO' | 'FILIACION' | 'OTRO'>
            options={[
              { key: 'MATRIMONIO', label: 'Matrimonio (cónyuge)' },
              { key: 'CONCUBINATO', label: 'Concubinato' },
              { key: 'FILIACION', label: 'Filiación (hijo/hija)' },
              { key: 'OTRO', label: 'Otro parentesco' },
            ]}
            value={answers.relacionPartes}
            onChange={v => update({ relacionPartes: v })}
          />
        </div>
        {answers.relacionPartes && (
          <div>
            <label style={lbl}>Descripción de la relación</label>
            <input style={inp}
              placeholder={
                answers.relacionPartes === 'MATRIMONIO' ? 'Ej: Cónyuges desde el 15 de junio de 2010, casados por el civil en León, Gto.' :
                answers.relacionPartes === 'CONCUBINATO' ? 'Ej: Concubinos desde aproximadamente 2015, viviendo juntos en el mismo domicilio.' :
                answers.relacionPartes === 'FILIACION' ? 'Ej: El actor es hijo/hija del demandado, reconocido en acta de nacimiento.' :
                'Ej: Hermano/a, ascendiente, etc.'
              }
              value={answers.descripcionRelacion}
              onChange={e => update({ descripcionRelacion: e.target.value })}
            />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Ocupación del acreedor alimentario ({clientName || 'actor'})</label>
            <input style={inp} placeholder="Ej: Ama de casa / Estudiante / Empleado" value={answers.ocupacionAcreedor} onChange={e => update({ ocupacionAcreedor: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Ingresos mensuales del acreedor (si los tiene)</label>
            <input style={inp} placeholder="Ej: $0.00 / $3,500.00" value={answers.ingresosMensualesAcreedor} onChange={e => update({ ingresosMensualesAcreedor: e.target.value })} />
          </div>
        </div>
      </div>
    );

    /* ── PASO 2: Necesidades del acreedor ── */
    if (step === 2) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#c9a84c' }}>💡 Desglose de necesidades mensuales.</strong><br />
          Captura los gastos mensuales del acreedor alimentario. El total se calcula automáticamente.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { field: 'gastosAlimentacion' as const, label: 'Alimentación y despensa' },
            { field: 'gastosMedicamentos' as const, label: 'Salud y medicamentos' },
            { field: 'gastosVivienda' as const, label: 'Vivienda (renta / servicios)' },
            { field: 'gastosEducacion' as const, label: 'Educación (colegio / útiles)' },
            { field: 'gastosTransporte' as const, label: 'Transporte' },
            { field: 'otrosGastos' as const, label: 'Otros gastos (ropa, higiene, etc.)' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label style={lbl}>{label}</label>
              <input style={inp} placeholder="$0.00" value={answers[field]} onChange={e => updateGasto(field, e.target.value)} />
            </div>
          ))}
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Total mensual estimado</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#c9a84c' }}>
            ${answers.totalNecesidades ? parseFloat(answers.totalNecesidades).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
          </span>
        </div>
        <div>
          <label style={lbl}>Monto de pensión solicitada (puede ser igual o menor al total)</label>
          <input style={inp} placeholder="Ej: $4,500.00 mensuales" value={answers.montoPensionSolicitada} onChange={e => update({ montoPensionSolicitada: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Modalidad de pago</label>
          <OptionGroup<'DESCUENTO_NOMINA' | 'DEPOSITO' | 'EFECTIVO'>
            options={[
              { key: 'DESCUENTO_NOMINA', label: 'Descuento vía nómina (IMSS)' },
              { key: 'DEPOSITO', label: 'Depósito bancario' },
              { key: 'EFECTIVO', label: 'Pago en efectivo' },
            ]}
            value={answers.modalidadPago}
            onChange={v => update({ modalidadPago: v })}
          />
        </div>
        <div>
          <label style={lbl}>¿Se solicitará pensión provisional mientras dura el juicio?</label>
          <YesNo value={answers.pensionProvisional} onChange={v => update({ pensionProvisional: v })} />
        </div>
      </div>
    );

    /* ── PASO 3: Capacidad del deudor ── */
    if (step === 3) return (
      <div style={{ display: 'grid', gap: 18 }}>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Datos del deudor alimentario ({counterparty || 'demandado'}) para acreditar su capacidad económica.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Ocupación / Actividad económica del demandado</label>
            <input style={inp} placeholder="Ej: Empleado, comerciante, profesionista" value={answers.ocupacionDeudor} onChange={e => update({ ocupacionDeudor: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Empresa / Patrón donde labora (si aplica)</label>
            <input style={inp} placeholder="Ej: IMSS, empresa privada, negocio propio" value={answers.patronDeudor} onChange={e => update({ patronDeudor: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>Ingresos mensuales estimados del demandado</label>
          <input style={inp} placeholder="Ej: $15,000.00 / $8,000.00 / Se desconoce con precisión" value={answers.ingresosMensualesDeudor} onChange={e => update({ ingresosMensualesDeudor: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>¿Existen otros obligados alimentarios (ej: otro cónyuge, otros hijos)?</label>
          <YesNo value={answers.tieneOtrosObligados} onChange={v => update({ tieneOtrosObligados: v })} />
        </div>
      </div>
    );

    /* ── PASO 4: Hechos narrativos ── */
    if (step === 4) return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#c9a84c' }}>💡 Esta narración alimenta la sección HECHOS de la demanda.</strong><br />
          Incluya: origen de la obligación alimentaria, cuándo dejó de cumplirla el demandado, qué gestiones previas se realizaron, y situación actual del acreedor.
        </div>
        <div>
          <label style={lbl}>Narración de los hechos</label>
          <textarea
            style={{ ...inp, height: 220, resize: 'vertical', lineHeight: 1.75 }}
            placeholder="Ej: El suscrito y el demandado contrajeron matrimonio el [fecha]. El demandado ha dejado de contribuir a los alimentos del actor desde el mes de [mes/año], a pesar de tener capacidad económica para ello, pues labora como [ocupación] en [empresa]. Los intentos de arreglo extrajudicial no han prosperado..."
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
            Verificación del cuestionario — Pensión Alimenticia
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
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 2 }}>La IA tiene suficiente información para generar una demanda de alimentos precisa.</div>
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
          Demanda de Pensión Alimenticia
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
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
            Paso {step} de {TOTAL_STEPS}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
            {step === 1 && 'Relación entre las partes'}
            {step === 2 && 'Necesidades y prestaciones'}
            {step === 3 && 'Capacidad del deudor alimentario'}
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
              disabled={step === 1 && !answers.relacionPartes}
              style={{ ...btnPrimary, opacity: step === 1 && !answers.relacionPartes ? 0.45 : 1, cursor: step === 1 && !answers.relacionPartes ? 'not-allowed' : 'pointer' }}
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
