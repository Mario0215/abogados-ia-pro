import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  PORTAL_CONFIG,
  CIUDADES_GTO,
} from '../../lib/cliente-config';
import { getClienteFromCookies } from '../../lib/cliente-auth';

const G = '#896419';
const BG = '#0d1117';
const CARD = '#111827';
const BORDER = '#21262d';
const TEXT = '#e2e8f0';
const MUTED = '#8b949e';
const INPUT_BG = '#161b22';
const INPUT_BORDER = '#30363d';

const iSt: React.CSSProperties = {
  width: '100%',
  background: INPUT_BG,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 8,
  padding: '11px 14px',
  fontSize: 14,
  color: TEXT,
  fontFamily: 'Georgia, serif',
  outline: 'none',
  boxSizing: 'border-box',
};

const lSt: React.CSSProperties = {
  fontSize: 11,
  color: MUTED,
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const fRow: React.CSSProperties = { marginBottom: 16 };

const PASOS = ['Servicio', 'Tus datos', 'Cuestionario', 'Resumen'];

type Datos = { nombre: string; telefono: string; correo: string; domicilio: string; ciudad: string };

export default function Cuestionario() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [tipoServicio, setTipoServicio] = useState('');
  const [datos, setDatos] = useState<Datos>({ nombre: '', telefono: '', correo: '', domicilio: '', ciudad: '' });
  const [resp, setResp] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState<{ servicios: any[]; modificadores: any[] } | null>(null);
  const [pricingError, setPricingError] = useState('');

  const R = (key: string) => resp[key] || '';
  const setR = (key: string, val: string) => setResp((r) => ({ ...r, [key]: val }));
  const setD = (key: keyof Datos, val: string) => setDatos((d) => ({ ...d, [key]: val }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/admin/precios');
        const data = await r.json().catch(() => ({}));
        const servicios = Array.isArray(data.servicios) ? data.servicios : [];
        const modificadores = Array.isArray(data.modificadores) ? data.modificadores : [];
        if (!cancelled) {
          setPricing({ servicios, modificadores });
          setPricingError(servicios.length ? '' : 'Precios no configurados');
        }
      } catch {
        if (!cancelled) setPricingError('No se pudieron cargar los precios');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function calcCotizacion(): number {
    const s = pricing?.servicios?.find((x: any) => x.servicioId === tipoServicio && x.activo !== false);
    if (!s) return 0;
    const m = new Map<string, number>((pricing?.modificadores || []).map((x: any) => [String(x.key), Number(x.valor)]));
    let total = Number(s.precioBase) || 0;
    if (tipoServicio === 'DIVORCIO_CONTENCIOSO') total += m.get('EXTRA_CONTENCIOSO') || 0;
    if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio)) {
      if (R('tieneHijos') === 'si') total += Math.max(parseInt(R('numHijos') || '1'), 1) * (m.get('EXTRA_HIJO') || 0);
      if (R('bienesComun') === 'si') total += m.get('EXTRA_BIENES') || 0;
    }
    if (tipoServicio === 'PENSION_ALIMENTICIA') {
      const n = Math.max(parseInt(R('numHijos') || '0'), 0);
      if (n > 0) total += n * (m.get('EXTRA_HIJO') || 0);
    }
    return total;
  }

  function siguiente() {
    if (paso === 1) {
      if (!pricing || pricingError) { setError(pricingError || 'No se pudieron cargar los precios'); return; }
      if (!tipoServicio) { setError('Selecciona un tipo de servicio para continuar'); return; }
    }
    if (paso === 2) {
      if (!datos.nombre.trim()) { setError('El nombre completo es obligatorio'); return; }
      if (!/^\d{10}$/.test(datos.telefono.replace(/[\s\-()]/g, ''))) { setError('El teléfono debe tener 10 dígitos'); return; }
      if (!datos.correo.includes('@')) { setError('Ingresa un correo electrónico válido'); return; }
      if (!datos.ciudad) { setError('Selecciona tu ciudad'); return; }
    }
    setError('');
    setPaso((p) => p + 1);
  }

  function anterior() { setError(''); setPaso((p) => p - 1); }

  async function confirmar() {
    setLoading(true);
    setError('');
    try {
      const cotizacion = calcCotizacion();
      const anticipo = Math.round(cotizacion * 0.5);

      const sessionRes = await fetch('/api/cliente/me');
      const session = await sessionRes.json().catch(() => ({}));

      const r = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: anticipo,
          metadata: {
            tipoServicio,
            portalUserId: session.uid,
            datosPersonales: JSON.stringify(datos),
            respuestas: JSON.stringify(resp),
            cotizacion: String(cotizacion),
          },
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        router.push(`/cliente/pago?clientSecret=${encodeURIComponent(String(data.clientSecret || ''))}`);
      } else {
        setError(data.error || 'Error al iniciar el pago');
      }
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Helpers de renderizado ──────────────────────────────────────────────────

  function campo(key: string, label: string, type: 'text' | 'number' | 'date' | 'textarea' = 'text', placeholder = '') {
    return (
      <div style={fRow} key={key}>
        <label style={lSt}>{label}</label>
        {type === 'textarea' ? (
          <textarea
            value={R(key)}
            onChange={(e) => setR(key, e.target.value)}
            placeholder={placeholder}
            rows={3}
            style={{ ...iSt, resize: 'vertical' }}
          />
        ) : (
          <input
            type={type}
            value={R(key)}
            onChange={(e) => setR(key, e.target.value)}
            placeholder={placeholder}
            style={iSt}
          />
        )}
      </div>
    );
  }

  function yesno(key: string, label: string) {
    return (
      <div style={fRow} key={key}>
        <label style={lSt}>{label}</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {['si', 'no'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setR(key, v)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: `2px solid ${R(key) === v ? G : INPUT_BORDER}`,
                background: R(key) === v ? `${G}20` : INPUT_BG,
                color: R(key) === v ? G : MUTED,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'Georgia, serif',
                transition: 'all 0.15s',
              }}
            >
              {v === 'si' ? 'Sí' : 'No'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function selectCampo(key: string, label: string, options: string[]) {
    return (
      <div style={fRow} key={key}>
        <label style={lSt}>{label}</label>
        <select value={R(key)} onChange={(e) => setR(key, e.target.value)} style={iSt}>
          <option value="">-- Seleccionar --</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  // ── Cuestionario dinámico por tipo de servicio ──────────────────────────────

  function renderCampos() {
    switch (tipoServicio) {
      case 'DIVORCIO_MUTUO':
      case 'DIVORCIO_CONTENCIOSO':
        return (
          <>
            {campo('nombreConyuge', 'Nombre completo del cónyuge')}
            {campo('fechaMatrimonio', 'Fecha de matrimonio', 'date')}
            {yesno('tieneHijos', '¿Tienen hijos menores de edad?')}
            {R('tieneHijos') === 'si' && campo('numHijos', '¿Cuántos hijos menores?', 'number', '1')}
            {yesno('bienesComun', '¿Tienen bienes en común?')}
            {R('bienesComun') === 'si' && campo('descripcionBienes', 'Describa brevemente los bienes', 'textarea', 'Ej: casa en Col. Centro, vehículo 2020...')}
            {yesno('hayPension', '¿Hay pensión alimenticia?')}
            {campo('domicilioConyugal', 'Domicilio conyugal actual')}
            {yesno('domicilioDiferente', '¿El domicilio del cónyuge es diferente al conyugal?')}
            {R('domicilioDiferente') === 'si' && campo('domicilioConyuge', 'Domicilio actual del cónyuge')}
          </>
        );
      case 'PENSION_ALIMENTICIA':
        return (
          <>
            {campo('nombreObligado', 'Nombre del obligado a pagar')}
            {campo('numHijos', '¿Cuántos hijos?', 'number', '1')}
            {campo('edadesHijos', 'Edades de los hijos', 'text', 'Ej: 4, 8, 12 años')}
            {campo('montoMensual', 'Monto mensual solicitado (MXN)', 'number')}
            {campo('situacionLaboral', 'Situación laboral del demandado', 'text', 'Ej: empleado formal, comerciante...')}
            {yesno('juicioDivorcio', '¿Hay un juicio de divorcio en curso?')}
          </>
        );
      case 'PRESCRIPCION_ADQUISITIVA':
        return (
          <>
            {campo('ubicacionInmueble', 'Ubicación del inmueble')}
            {campo('anosPosesion', '¿Cuántos años lleva en posesión?', 'number')}
            {campo('superficieM2', 'Superficie aproximada (m²)', 'number')}
            {yesno('tieneDocumento', '¿Tiene algún documento del inmueble?')}
            {campo('colindantes', 'Nombre de colindantes (si los conoce)', 'text', 'Opcional')}
            {yesno('conoceDueno', '¿Conoce al dueño registrado?')}
          </>
        );
      case 'ARRENDAMIENTO':
        return (
          <>
            {campo('direccionInmueble', 'Dirección del inmueble rentado')}
            {yesno('hayContrato', '¿Hay contrato escrito?')}
            {campo('montoRenta', 'Monto mensual de renta (MXN)', 'number')}
            {campo('mesesVencidos', 'Meses vencidos sin pagar', 'number', '0')}
            {yesno('hayDeposito', '¿Hay depósito?')}
            {selectCampo('objetivoBuscado', '¿Qué busca?', ['Desalojo', 'Cobro de rentas', 'Ambos'])}
          </>
        );
      case 'NULIDAD_CONTRATO':
        return (
          <>
            {selectCampo('tipoContrato', 'Tipo de contrato', ['Compraventa', 'Prestación de servicios', 'Arrendamiento', 'Otro'])}
            {campo('fechaContrato', 'Fecha del contrato', 'date')}
            {campo('montoInvolucrado', 'Monto involucrado (MXN)', 'number')}
            {selectCampo('motivoNulidad', 'Motivo de nulidad', ['Vicios del consentimiento', 'Objeto ilícito', 'Falsificación', 'Incapacidad', 'Otro'])}
            {campo('nombreContraparte', 'Nombre de la contraparte')}
          </>
        );
      case 'DANOS_PERJUICIOS':
        return (
          <>
            {campo('descripcionDano', 'Descripción del daño sufrido', 'textarea')}
            {campo('fechaHecho', 'Fecha del hecho', 'date')}
            {campo('nombreResponsable', 'Nombre del responsable')}
            {campo('montoEstimado', 'Monto estimado del daño (MXN)', 'number')}
            {yesno('tieneDocumentos', '¿Hay documentos que prueben el daño?')}
          </>
        );
      case 'SUCESION':
        return (
          <>
            {campo('nombreFallecido', 'Nombre del fallecido')}
            {campo('fechaFallecimiento', 'Fecha de fallecimiento', 'date')}
            {yesno('hayTestamento', '¿Hay testamento?')}
            {campo('numHerederos', 'Número de herederos', 'number')}
            {campo('tipoBienes', 'Tipo de bienes', 'textarea', 'Ej: inmuebles, vehículos, cuentas bancarias...')}
            {yesno('hayMenoresHerederos', '¿Hay menores de edad entre los herederos?')}
          </>
        );
      default:
        return (
          <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>
            Selecciona un servicio en el paso anterior.
          </div>
        );
    }
  }

  // ── Paso 4: cálculo y desglose de cotización ────────────────────────────────

  const servicioSel = pricing?.servicios?.find((s: any) => s.servicioId === tipoServicio) || null;
  const cotizacion = paso === 4 ? calcCotizacion() : 0;
  const anticipo = Math.round(cotizacion * 0.5);

  const desglose: { label: string; monto: number }[] = [];
  if (servicioSel) {
    const m = new Map<string, number>((pricing?.modificadores || []).map((x: any) => [String(x.key), Number(x.valor)]));
    desglose.push({ label: 'Honorarios base', monto: Number(servicioSel.precioBase || 0) });
    if (tipoServicio === 'DIVORCIO_CONTENCIOSO') desglose.push({ label: 'Proceso contencioso', monto: m.get('EXTRA_CONTENCIOSO') || 0 });
    if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio) && R('tieneHijos') === 'si') {
      const n = Math.max(parseInt(R('numHijos') || '1'), 1);
      desglose.push({ label: `${n} hijo(s) menor(es)`, monto: n * (m.get('EXTRA_HIJO') || 0) });
    }
    if (['DIVORCIO_MUTUO', 'DIVORCIO_CONTENCIOSO'].includes(tipoServicio) && R('bienesComun') === 'si') {
      desglose.push({ label: 'División de bienes en común', monto: m.get('EXTRA_BIENES') || 0 });
    }
    if (tipoServicio === 'PENSION_ALIMENTICIA') {
      const n = Math.max(parseInt(R('numHijos') || '0'), 0);
      if (n > 0) desglose.push({ label: `${n} hijo(s)`, monto: n * (m.get('EXTRA_HIJO') || 0) });
    }
  }

  return (
    <>
      <Head><title>Iniciar caso — {PORTAL_CONFIG.nombreDespacho}</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; font-family: Georgia, serif; color: ${TEXT}; }
        a { text-decoration: none; }
        select option { background: ${INPUT_BG}; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/cliente" style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{PORTAL_CONFIG.nombreDespacho}</Link>
        <Link href="/cliente/dashboard" style={{ fontSize: 13, color: MUTED }}>Mi portal</Link>
      </header>

      {/* BARRA DE PROGRESO */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex' }}>
          {PASOS.map((label, i) => {
            const n = i + 1;
            const active = paso === n;
            const done = paso > n;
            return (
              <div
                key={n}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  textAlign: 'center',
                  borderBottom: `3px solid ${active ? G : done ? `${G}55` : 'transparent'}`,
                }}
              >
                <div style={{ fontSize: 11, color: active ? G : done ? `${G}99` : '#4b5563', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {n}. {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── PASO 1: Tipo de servicio ──────────────────────────────────────── */}
        {paso === 1 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>¿Qué servicio necesitas?</h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
              Selecciona el tipo de asunto legal. La cotización se calcula automáticamente.
            </p>
            {pricingError && (
              <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '10px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
                {pricingError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {(pricing?.servicios || []).filter((s: any) => s.activo !== false).map((s: any) => (
                <button
                  key={s.servicioId}
                  type="button"
                  onClick={() => { setTipoServicio(s.servicioId); setError(''); }}
                  style={{
                    padding: '18px 16px',
                    borderRadius: 12,
                    border: `2px solid ${tipoServicio === s.servicioId ? G : BORDER}`,
                    background: tipoServicio === s.servicioId ? `${G}18` : CARD,
                    color: tipoServicio === s.servicioId ? G : TEXT,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{s.nombre}</div>
                  <div style={{ fontSize: 12, color: tipoServicio === s.servicioId ? `${G}cc` : '#6b7280' }}>
                    {s.precioDesde ? 'Desde ' : ''}${Number(s.precioBase || 0).toLocaleString()} MXN
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 2: Datos personales ──────────────────────────────────────── */}
        {paso === 2 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>Tus datos personales</h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
              Los usamos para registrar y dar seguimiento a tu expediente. Son estrictamente confidenciales.
            </p>
            <div style={fRow}>
              <label style={lSt}>Nombre completo *</label>
              <input type="text" value={datos.nombre} onChange={(e) => setD('nombre', e.target.value)} required style={iSt} placeholder="Juan Pérez García" autoFocus />
            </div>
            <div style={fRow}>
              <label style={lSt}>Teléfono (10 dígitos) *</label>
              <input type="tel" value={datos.telefono} onChange={(e) => setD('telefono', e.target.value)} required style={iSt} placeholder="4771234567" maxLength={15} />
            </div>
            <div style={fRow}>
              <label style={lSt}>Correo electrónico *</label>
              <input type="email" value={datos.correo} onChange={(e) => setD('correo', e.target.value)} required style={iSt} placeholder="tu@correo.com" />
            </div>
            <div style={fRow}>
              <label style={lSt}>Domicilio completo</label>
              <input type="text" value={datos.domicilio} onChange={(e) => setD('domicilio', e.target.value)} style={iSt} placeholder="Calle 1 #23, Col. Centro, C.P. 37000" />
            </div>
            <div style={fRow}>
              <label style={lSt}>Ciudad *</label>
              <select value={datos.ciudad} onChange={(e) => setD('ciudad', e.target.value)} required style={iSt}>
                <option value="">-- Seleccionar ciudad --</option>
                {CIUDADES_GTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── PASO 3: Cuestionario dinámico ────────────────────────────────── */}
        {paso === 3 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>Cuestionario</h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
              Responde las siguientes preguntas sobre tu caso. La información es confidencial y sirve para preparar tu expediente.
            </p>
            {renderCampos()}
          </div>
        )}

        {/* ── PASO 4: Resumen y cotización ─────────────────────────────────── */}
        {paso === 4 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', marginBottom: 8 }}>Resumen y cotización</h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
              Revisa los detalles antes de confirmar. Un abogado te contactará para coordinar el anticipo.
            </p>

            {/* Servicio */}
            <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Servicio seleccionado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: G }}>{servicioSel?.nombre}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{datos.ciudad}</div>
            </div>

            {/* Cotización */}
            <div style={{ background: `${G}10`, borderRadius: 12, border: `1px solid ${G}35`, padding: '24px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Cotización estimada</div>
              <div style={{ marginBottom: 12 }}>
                {desglose.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 6 }}>
                    <span>{d.label}</span>
                    <span style={{ color: TEXT }}>+${d.monto.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${G}30`, paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Total estimado</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: G }}>${cotizacion.toLocaleString()} MXN</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: MUTED }}>Anticipo requerido (50%)</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>${anticipo.toLocaleString()} MXN</span>
                </div>
              </div>
            </div>

            {/* Datos de contacto */}
            <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Datos de contacto</div>
              {([
                { label: 'Nombre', value: datos.nombre },
                { label: 'Teléfono', value: datos.telefono },
                { label: 'Correo', value: datos.correo },
                datos.domicilio ? { label: 'Domicilio', value: datos.domicilio } : null,
                { label: 'Ciudad', value: datos.ciudad },
              ] as ({ label: string; value: string } | null)[]).filter(Boolean).map((item) => (
                <div key={item!.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: MUTED }}>{item!.label}</span>
                  <span style={{ color: TEXT, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' }}>{item!.value}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7, marginBottom: 8 }}>
              Al confirmar, se crea tu expediente con estado <strong style={{ color: MUTED }}>PENDIENTE</strong>.
              Un abogado del despacho lo revisará y se pondrá en contacto contigo para coordinar el anticipo y los siguientes pasos.
            </p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginTop: 16, marginBottom: 4 }}>
            {error}
          </div>
        )}

        {/* NAVEGACIÓN */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          {paso > 1 && (
            <button
              type="button"
              onClick={anterior}
              style={{ flex: 1, background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '13px', fontSize: 14, cursor: 'pointer', fontFamily: 'Georgia, serif' }}
            >
              Anterior
            </button>
          )}
          {paso < 4 ? (
            <button
              type="button"
              onClick={siguiente}
              style={{ flex: 2, background: G, color: BG, border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={confirmar}
              disabled={loading}
              style={{ flex: 2, background: loading ? '#374151' : G, color: loading ? MUTED : BG, border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Georgia, serif' }}
            >
              {loading ? 'Iniciando pago...' : 'Pagar anticipo'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return { redirect: { destination: '/cliente/login', permanent: false } };
  return { props: {} };
};
