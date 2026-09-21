import Head from 'next/head';
import Link from 'next/link';
import { PORTAL_CONFIG } from '../lib/cliente-config';

const MATERIAS = [
  {
    id: 'familiar',
    nombre: 'Derecho Familiar',
    icono: '♥',
    introduccion:
      'Asuntos relacionados con el matrimonio, la filiación, los alimentos y las relaciones familiares. Atención con sensibilidad y claridad en cada etapa.',
    serviciosIds: ['divorcio', 'alimentos'],
    color: 'var(--pro-navy)',
  },
  {
    id: 'civil',
    nombre: 'Derecho Civil',
    icono: '⌂',
    introduccion:
      'Conflictos y trámites sobre bienes inmuebles, contratos de arrendamiento, prescripción adquisitiva y sucesiones. Respuesta conforme al Código Civil de Guanajuato.',
    serviciosIds: ['arrendamiento', 'usucapion', 'sucesion'],
    color: 'var(--pro-blue)',
  },
  {
    id: 'laboral',
    nombre: 'Derecho Laboral',
    icono: '↗',
    introduccion:
      'Orientación inicial para identificar tu situación laboral y canalizarla con el abogado adecuado. La plataforma valora tu caso y sugiere el siguiente paso.',
    serviciosIds: ['consulta'],
    color: 'var(--pro-gold)',
  },
] as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="m4.5 10.5 3.3 3.2 7.7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatearPrecio(precio: number, moneda: string, desde: boolean) {
  const simbolo = moneda === 'MXN' ? '$' : moneda + ' ';
  const base = simbolo + precio.toLocaleString('es-MX');
  return (desde ? 'Desde ' : '') + base;
}

export default function ServiciosPage() {
  const serviciosMap = new Map(PORTAL_CONFIG.servicios.map((s) => [s.id, s]));

  return (
    <>
      <Head>
        <title>Servicios | Abogados IA Pro — Materias Familiar, Civil y Laboral en Guanajuato</title>
        <meta
          name="description"
          content="Explora las materias Familiar, Civil y Laboral de Abogados IA Pro. Conoce los servicios disponibles, su alcance y solicita atención con el flujo para clientes."
        />
        <meta name="theme-color" content="#071a35" />
      </Head>

      <style jsx global>{`
        :root {
          --pro-navy: #071a35;
          --pro-navy-deep: #041226;
          --pro-blue: #17487f;
          --pro-blue-soft: #e9f1fb;
          --pro-gold: #c79a4b;
          --pro-ink: #14233a;
          --pro-muted: #61708a;
          --pro-sand: #f8f6f2;
          --pro-line: #dbe2eb;
        }
        html { scroll-behavior: smooth; }
        body { background: var(--pro-sand); }
        * { box-sizing: border-box; }
        a:focus-visible { outline: 3px solid var(--pro-gold); outline-offset: 4px; }

        .pro-page {
          min-height: 100vh;
          overflow: hidden;
          color: var(--pro-ink);
          background: var(--pro-sand);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pro-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }

        .pro-header {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          position: relative;
          z-index: 2;
        }
        .pro-brand { display: inline-flex; align-items: center; gap: 11px; color: var(--pro-navy); text-decoration: none; white-space: nowrap; }
        .pro-mark {
          width: 37px; height: 37px; display: grid; place-items: center;
          border-radius: 11px; color: #fff;
          background: linear-gradient(135deg, var(--pro-navy), #123f70);
          box-shadow: 0 9px 18px rgba(7, 26, 53, 0.16);
        }
        .pro-brand-title { display: block; font-size: 1.02rem; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
        .pro-brand-subtitle { display: block; margin-top: 3px; color: var(--pro-gold); font-size: 0.63rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        .pro-navigation { display: flex; align-items: center; justify-content: center; gap: 25px; }
        .pro-navigation a { color: #43516a; font-size: 0.88rem; font-weight: 650; text-decoration: none; transition: color 160ms ease; }
        .pro-navigation a:hover { color: var(--pro-blue); }
        .pro-header-actions { display: flex; align-items: center; gap: 12px; }

        .pro-button {
          min-height: 46px; display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; padding: 0 20px; border: 1px solid transparent; border-radius: 9px;
          font: inherit; font-size: 0.9rem; font-weight: 800; text-decoration: none;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .pro-button:hover { transform: translateY(-2px); }
        .pro-button-primary { color: #fff; background: var(--pro-navy); box-shadow: 0 12px 22px rgba(7, 26, 53, 0.16); }
        .pro-button-primary:hover { background: #0d315e; box-shadow: 0 16px 26px rgba(7, 26, 53, 0.2); }
        .pro-button-secondary { color: var(--pro-navy); background: #fff; border-color: #c7d4e3; }
        .pro-button-secondary:hover { border-color: var(--pro-gold); }
        .pro-button-gold { color: var(--pro-navy-deep); background: var(--pro-gold); box-shadow: 0 13px 26px rgba(199, 154, 75, 0.28); }
        .pro-button-gold:hover { background: #d5aa60; }
        .pro-button-sm { min-height: 40px; padding: 0 16px; font-size: 0.82rem; }

        .pro-hero { position: relative; background: linear-gradient(112deg, #f8f6f2 0%, #f8f6f2 55%, #eef4fb 100%); }
        .pro-hero::before {
          content: ''; position: absolute; right: -180px; top: -280px;
          width: 680px; height: 680px;
          border: 1px solid rgba(23, 72, 127, 0.1); border-radius: 50%;
          box-shadow: 0 0 0 65px rgba(23, 72, 127, 0.035), 0 0 0 130px rgba(23, 72, 127, 0.02);
          pointer-events: none;
        }
        .pro-hero-inner {
          position: relative; z-index: 1;
          padding: 74px 0 84px;
        }
        .pro-eyebrow { margin: 0 0 17px; color: var(--pro-gold); font-size: 0.71rem; font-weight: 850; letter-spacing: 0.16em; text-transform: uppercase; }
        .pro-hero h1 { max-width: 780px; margin: 0; color: var(--pro-navy); font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.4rem, 4.5vw, 4.1rem); font-weight: 600; letter-spacing: -0.052em; line-height: 1.02; }
        .pro-hero h1 span { color: var(--pro-blue); }
        .pro-hero-copy { max-width: 640px; margin: 24px 0 28px; color: #52617a; font-size: 1.05rem; line-height: 1.75; }
        .pro-cta-row { display: flex; flex-wrap: wrap; gap: 13px; }
        .pro-assurance { display: flex; flex-wrap: wrap; gap: 18px; margin: 26px 0 0; padding: 0; list-style: none; }
        .pro-assurance li { display: flex; align-items: center; gap: 7px; color: #4d5c73; font-size: 0.81rem; font-weight: 650; }
        .pro-assurance svg { color: var(--pro-gold); }

        .pro-materia-nav {
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-top: 40px;
        }
        .pro-materia-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 999px;
          border: 1px solid var(--pro-line); background: #fff;
          color: var(--pro-ink); font-size: 0.82rem; font-weight: 700; text-decoration: none;
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .pro-materia-chip:hover { border-color: var(--pro-gold); transform: translateY(-1px); }
        .pro-materia-chip svg { width: 14px; height: 14px; color: var(--pro-gold); }

        .pro-section { padding: 96px 0; }
        .pro-section + .pro-section { border-top: 1px solid #e8edf3; }
        .pro-section-heading { max-width: 690px; margin-bottom: 43px; }
        .pro-kicker { margin: 0 0 12px; color: var(--pro-gold); font-size: 0.71rem; font-weight: 850; letter-spacing: 0.15em; text-transform: uppercase; }
        .pro-section-heading h2 { max-width: 680px; margin: 0; color: var(--pro-navy); font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 3.5vw, 3.1rem); font-weight: 600; letter-spacing: -0.042em; line-height: 1.05; }
        .pro-section-heading p { max-width: 610px; margin: 17px 0 0; color: var(--pro-muted); font-size: 1rem; line-height: 1.72; }

        .pro-materia-wrap {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr);
          gap: 64px;
          align-items: start;
        }
        .pro-materia-intro { position: sticky; top: 32px; }
        .pro-materia-badge {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 12px;
          background: var(--pro-blue-soft); color: var(--pro-blue);
          font-size: 0.74rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
          margin-bottom: 20px;
        }
        .pro-materia-badge.m-laboral { background: rgba(199,154,75,0.14); color: #8a6828; }
        .pro-materia-badge-icon {
          width: 28px; height: 28px; display: grid; place-items: center;
          border-radius: 8px; background: #fff; color: currentColor; font-size: 1.1rem;
        }
        .pro-materia-intro h2 {
          margin: 0; color: var(--pro-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(2rem, 3.2vw, 2.8rem); font-weight: 600; letter-spacing: -0.04em; line-height: 1.06;
        }
        .pro-materia-intro p {
          max-width: 520px; margin: 20px 0 26px;
          color: var(--pro-muted); font-size: 1rem; line-height: 1.75;
        }
        .pro-materia-cta-box {
          padding: 22px; border: 1px solid var(--pro-line); border-radius: 14px; background: #fff;
        }
        .pro-materia-cta-box strong { display: block; color: var(--pro-navy); font-size: 0.92rem; margin-bottom: 6px; }
        .pro-materia-cta-box small { display: block; color: var(--pro-muted); font-size: 0.8rem; line-height: 1.5; margin-bottom: 14px; }

        .pro-service-list { display: grid; gap: 14px; }
        .pro-service-card {
          display: flex; flex-direction: column;
          padding: 26px; border: 1px solid var(--pro-line); border-radius: 15px; background: #fff;
          box-shadow: 0 10px 25px rgba(14, 42, 75, 0.045);
          transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
        }
        .pro-service-card:hover { transform: translateY(-4px); border-color: #c7aa78; box-shadow: 0 16px 32px rgba(14, 42, 75, 0.1); }
        .pro-service-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
          margin-bottom: 14px;
        }
        .pro-service-title { margin: 0; color: var(--pro-navy); font-size: 1.12rem; font-weight: 800; }
        .pro-service-price {
          flex: 0 0 auto;
          color: var(--pro-navy); font-weight: 800; font-size: 1.05rem;
          padding: 6px 12px; border-radius: 8px;
          background: var(--pro-blue-soft); color: var(--pro-blue);
          white-space: nowrap;
        }
        .pro-service-price small { font-weight: 600; margin-left: 4px; opacity: 0.75; font-size: 0.72rem; }
        .pro-service-desc { margin: 0 0 22px; color: var(--pro-muted); font-size: 0.9rem; line-height: 1.7; }
        .pro-service-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding-top: 18px; border-top: 1px solid var(--pro-line); margin-top: auto;
        }
        .pro-service-note { color: var(--pro-muted); font-size: 0.75rem; font-weight: 600; }

        .pro-how { background: #fff; border-top: 1px solid #e8edf3; border-bottom: 1px solid #e8edf3; }
        .pro-step-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; border: 1px solid var(--pro-line); border-radius: 16px; overflow: hidden; }
        .pro-step { min-height: 220px; padding: 28px; border-right: 1px solid var(--pro-line); background: #fff; }
        .pro-step:last-child { border-right: 0; }
        .pro-step-number { color: var(--pro-gold); font-size: 0.78rem; font-weight: 850; letter-spacing: 0.14em; }
        .pro-step h3 { margin: 28px 0 10px; color: var(--pro-navy); font-size: 1.05rem; }
        .pro-step p { margin: 0; color: var(--pro-muted); font-size: 0.86rem; line-height: 1.65; }

        .pro-final-cta { padding: 78px 0; background: linear-gradient(110deg, #f3eadb, #fbf8f2 56%, #e6eff9); }
        .pro-final-content { display: flex; align-items: center; justify-content: space-between; gap: 32px; }
        .pro-final-content h2 { max-width: 650px; margin: 0; color: var(--pro-navy); font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 3.5vw, 3.1rem); font-weight: 600; letter-spacing: -0.04em; line-height: 1.08; }
        .pro-final-content p { margin: 13px 0 0; color: var(--pro-muted); font-size: 0.97rem; line-height: 1.6; }

        .pro-footer { padding: 53px 0 24px; color: #c0cede; background: var(--pro-navy-deep); }
        .pro-footer-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 38px; padding-bottom: 37px; }
        .pro-footer .pro-brand { color: #fff; }
        .pro-footer .pro-mark { background: linear-gradient(135deg, var(--pro-gold), #a97932); }
        .pro-footer .pro-brand-subtitle { color: #e9cd9a; }
        .pro-footer-title { margin: 0 0 14px; color: #fff; font-size: 0.82rem; font-weight: 800; }
        .pro-footer-copy { max-width: 310px; margin: 15px 0 0; color: #aebed3; font-size: 0.8rem; line-height: 1.65; }
        .pro-footer-list { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }
        .pro-footer-list a, .pro-footer-list span { color: #b9c8dc; font-size: 0.8rem; text-decoration: none; }
        .pro-footer-list a:hover { color: #fff; }
        .pro-footer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 20px; border-top: 1px solid rgba(215, 229, 246, 0.13); color: #8193aa; font-size: 0.72rem; }

        @media (max-width: 1000px) {
          .pro-navigation { gap: 15px; }
          .pro-step-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pro-materia-wrap { grid-template-columns: 1fr; gap: 32px; }
          .pro-materia-intro { position: static; }
        }
        @media (max-width: 780px) {
          .pro-shell { width: min(100% - 36px, 620px); }
          .pro-header { min-height: auto; padding: 18px 0; flex-wrap: wrap; }
          .pro-navigation { order: 3; width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; justify-content: stretch; }
          .pro-navigation a { white-space: normal; }
          .pro-header-actions { margin-left: auto; }
          .pro-header-actions .pro-button { min-height: 40px; padding: 0 14px; font-size: 0.8rem; }
          .pro-hero-inner { padding: 54px 0 66px; }
          .pro-step:nth-child(2) { border-right: 0; }
          .pro-step:nth-child(-n + 2) { border-bottom: 1px solid var(--pro-line); }
          .pro-section { padding: 72px 0; }
          .pro-final-content { align-items: flex-start; flex-direction: column; }
          .pro-footer-grid { grid-template-columns: 1fr 1fr; }
          .pro-footer-grid > :first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 540px) {
          .pro-shell { width: min(100% - 32px, 460px); }
          .pro-brand-title { font-size: 0.94rem; }
          .pro-brand-subtitle { font-size: 0.57rem; }
          .pro-header-actions .pro-button-secondary { display: none; }
          .pro-hero h1 { font-size: clamp(2.2rem, 11vw, 3rem); }
          .pro-hero-copy { font-size: 0.97rem; }
          .pro-cta-row { display: grid; width: 100%; }
          .pro-cta-row .pro-button { width: 100%; }
          .pro-assurance { display: grid; gap: 11px; }
          .pro-service-card { padding: 22px; }
          .pro-service-head { flex-direction: column; align-items: flex-start; gap: 10px; }
          .pro-service-foot { flex-direction: column; align-items: flex-start; gap: 12px; }
          .pro-service-foot .pro-button { width: 100%; }
          .pro-step-grid { grid-template-columns: 1fr; }
          .pro-step { min-height: 0; border-right: 0; border-bottom: 1px solid var(--pro-line); }
          .pro-step:last-child { border-bottom: 0; }
          .pro-footer-grid { grid-template-columns: 1fr; }
          .pro-footer-grid > :first-child { grid-column: auto; }
          .pro-footer-bottom { align-items: flex-start; flex-direction: column; }
        }
      `}</style>

      <main className="pro-page">
        <section className="pro-hero">
          <div className="pro-shell">
            <header className="pro-header">
              <Link className="pro-brand" href="/" aria-label="Abogados IA Pro, inicio">
                <span className="pro-mark" aria-hidden="true">⚖</span>
                <span>
                  <span className="pro-brand-title">Abogados IA Pro</span>
                  <span className="pro-brand-subtitle">Legal tech Guanajuato</span>
                </span>
              </Link>

              <nav className="pro-navigation" aria-label="Navegación principal">
                <Link href="/">Inicio</Link>
                <a href="#familiar">Familiar</a>
                <a href="#civil">Civil</a>
                <a href="#laboral">Laboral</a>
                <a href="#flujo">Cómo funciona</a>
                <Link href="/cliente/login">Acceso clientes</Link>
              </nav>

              <div className="pro-header-actions">
                <Link className="pro-button pro-button-secondary" href="/login">Acceso abogados</Link>
                <Link className="pro-button pro-button-primary" href="/cliente/cuestionario">Solicitar servicio</Link>
              </div>
            </header>

            <div className="pro-hero-inner" aria-labelledby="servicios-title">
              <p className="pro-eyebrow">Catálogo público de servicios</p>
              <h1 id="servicios-title">Tres materias, una ruta <span>clara para tu asunto.</span></h1>
              <p className="pro-hero-copy">
                Explora las materias disponibles en Abogados IA Pro. Cada sección explica el alcance de la atención, los servicios configurados y el siguiente paso para solicitar el acompañamiento adecuado en Guanajuato.
              </p>
              <div className="pro-cta-row">
                <Link className="pro-button pro-button-gold" href="#familiar">
                  Ver materias <ArrowIcon />
                </Link>
                <Link className="pro-button pro-button-secondary" href="/cliente/cuestionario">
                  Ir al cuestionario
                </Link>
              </div>

              <ul className="pro-assurance" aria-label="Garantías de la plataforma">
                <li><CheckIcon /> Atención en Guanajuato</li>
                <li><CheckIcon /> Abogado asignado y verificado</li>
                <li><CheckIcon /> Seguimiento digital del expediente</li>
              </ul>

              <nav className="pro-materia-nav" aria-label="Acceso directo a materias">
                <a className="pro-materia-chip" href="#familiar">
                  <CheckIcon /> Derecho Familiar
                </a>
                <a className="pro-materia-chip" href="#civil">
                  <CheckIcon /> Derecho Civil
                </a>
                <a className="pro-materia-chip" href="#laboral">
                  <CheckIcon /> Derecho Laboral
                </a>
              </nav>
            </div>
          </div>
        </section>

        {MATERIAS.map((materia, idx) => {
          const servicios = materia.serviciosIds
            .map((id) => serviciosMap.get(id))
            .filter((s): s is typeof PORTAL_CONFIG.servicios[number] => !!s);

          const badgeCls = materia.id === 'laboral' ? 'm-laboral' : '';
          const bgCls = idx % 2 === 1 ? { background: '#fff' } : undefined;

          return (
            <section id={materia.id} key={materia.id} className="pro-section" aria-labelledby={`title-${materia.id}`} style={bgCls}>
              <div className="pro-shell pro-materia-wrap">
                <div className="pro-materia-intro">
                  <div className={`pro-materia-badge ${badgeCls}`}>
                    <span className="pro-materia-badge-icon" aria-hidden="true">{materia.icono}</span>
                    Materia {idx + 1} de 3
                  </div>
                  <h2 id={`title-${materia.id}`}>{materia.nombre}</h2>
                  <p>{materia.introduccion}</p>

                  <div className="pro-materia-cta-box">
                    <strong>Solicita atención en {materia.nombre.split(' ').slice(1).join(' ')}</strong>
                    <small>El cuestionario inicial recopila los datos esenciales. Tu solicitud se valida y se asigna a un abogado con cobertura adecuada.</small>
                    <Link className="pro-button pro-button-primary pro-button-sm" href="/cliente/cuestionario">
                      Solicitar servicio <ArrowIcon />
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="pro-section-heading" style={{ marginBottom: 24 }}>
                    <p className="pro-kicker">Servicios configurados</p>
                    <h2 style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)' }}>
                      {servicios.length > 1 ? `${servicios.length} servicios disponibles` : 'Servicio disponible'}
                    </h2>
                    <p style={{ marginBottom: 0 }}>
                      Los siguientes servicios están dados de alta en la configuración del portal. Los precios se muestran tal cual aparecen en la configuración oficial.
                    </p>
                  </div>

                  <div className="pro-service-list">
                    {servicios.length === 0 ? (
                      <div className="pro-service-card">
                        <h3 className="pro-service-title">Próximamente</h3>
                        <p className="pro-service-desc">
                          Los servicios específicos de esta materia estarán disponibles en próximas versiones. Mientras tanto, puedes solicitar una consulta legal inicial para evaluar tu caso.
                        </p>
                        <div className="pro-service-foot">
                          <span className="pro-service-note">Puedes usar el servicio de Consulta Legal general</span>
                          <Link className="pro-button pro-button-gold pro-button-sm" href="/cliente/cuestionario">
                            Ir al cuestionario <ArrowIcon />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      servicios.map((s) => (
                        <article className="pro-service-card" key={s.id}>
                          <div className="pro-service-head">
                            <h3 className="pro-service-title">{s.nombre}</h3>
                            <span className="pro-service-price">
                              {formatearPrecio(s.precio, s.moneda, s.desde)}
                              <small>MXN</small>
                            </span>
                          </div>
                          <p className="pro-service-desc">{s.descripcion}</p>
                          <div className="pro-service-foot">
                            <span className="pro-service-note">
                              Cuestionario guiado · Asignación de abogado · Seguimiento digital
                            </span>
                            <Link className="pro-button pro-button-gold pro-button-sm" href="/cliente/cuestionario">
                              Solicitar <ArrowIcon />
                            </Link>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <section id="flujo" className="pro-section pro-how" aria-labelledby="flujo-title">
          <div className="pro-shell">
            <div className="pro-section-heading">
              <p className="pro-kicker">Flujo del cliente</p>
              <h2 id="flujo-title">Cuatro pasos, del primer clic al seguimiento de tu expediente.</h2>
              <p>Todos los servicios siguen el mismo flujo: el cuestionario define la materia y tus datos, la plataforma valida la disponibilidad y te asigna a un profesional.</p>
            </div>
            <div className="pro-step-grid">
              {[
                ['01', 'Cuéntanos tu caso', 'Selecciona la materia y comparte los datos esenciales de tu situación a través del cuestionario.'],
                ['02', 'Validamos tu solicitud', 'Confirmamos municipio, materia y disponibilidad de un abogado afiliado con la cobertura adecuada.'],
                ['03', 'Asignamos a tu abogado', 'Recibes notificación con el perfil profesional asignado y los siguientes pasos.'],
                ['04', 'Seguimiento en línea', 'Consulta documentos, avances, plazos y comunicaciones desde tu expediente digital.'],
              ].map(([number, title, description]) => (
                <article className="pro-step" key={number}>
                  <span className="pro-step-number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pro-final-cta" aria-labelledby="cta-final-title">
          <div className="pro-shell pro-final-content">
            <div>
              <h2 id="cta-final-title">¿Ya sabes qué materia necesitas?</h2>
              <p>Inicia el cuestionario. Toma menos de 5 minutos compartir los datos iniciales de tu caso.</p>
            </div>
            <Link className="pro-button pro-button-primary" href="/cliente/cuestionario">
              Solicitar servicio <ArrowIcon />
            </Link>
          </div>
        </section>

        <footer className="pro-footer">
          <div className="pro-shell">
            <div className="pro-footer-grid">
              <div>
                <Link className="pro-brand" href="/" aria-label="Abogados IA Pro, inicio">
                  <span className="pro-mark" aria-hidden="true">⚖</span>
                  <span>
                    <span className="pro-brand-title">Abogados IA Pro</span>
                    <span className="pro-brand-subtitle">Legal tech Guanajuato</span>
                  </span>
                </Link>
                <p className="pro-footer-copy">Plataforma de servicios legales Familiar, Civil y Laboral con seguimiento digital y asignación de abogados afiliados en Guanajuato.</p>
              </div>
              <div>
                <p className="pro-footer-title">Servicios</p>
                <ul className="pro-footer-list">
                  <li><a href="#familiar">Derecho Familiar</a></li>
                  <li><a href="#civil">Derecho Civil</a></li>
                  <li><a href="#laboral">Derecho Laboral</a></li>
                  <li><Link href="/cliente/cuestionario">Solicitar atención</Link></li>
                </ul>
              </div>
              <div>
                <p className="pro-footer-title">Accesos</p>
                <ul className="pro-footer-list">
                  <li><Link href="/">Inicio</Link></li>
                  <li><Link href="/cliente/login">Acceso clientes</Link></li>
                  <li><Link href="/login">Acceso abogados</Link></li>
                  <li><Link href="/cliente/faq">Preguntas frecuentes</Link></li>
                </ul>
              </div>
            </div>
            <div className="pro-footer-bottom">
              <span>© {new Date().getFullYear()} Abogados IA Pro. Todos los derechos reservados.</span>
              <span>Guanajuato, México · Atención limitada a municipios con cobertura confirmada.</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
