import Head from 'next/head';
import Link from 'next/link';

const services = [
  {
    name: 'Divorcio',
    description: 'Orientación y acompañamiento para iniciar tu proceso con información clara desde el primer paso.',
    icon: '§',
  },
  {
    name: 'Pensión alimenticia',
    description: 'Atención para solicitudes, convenios y procedimientos relacionados con alimentos.',
    icon: '¤',
  },
  {
    name: 'Laboral',
    description: 'Apoyo para identificar tu situación y canalizarla con un abogado de la materia.',
    icon: '↗',
  },
  {
    name: 'Arrendamiento',
    description: 'Asesoría para conflictos, contratos y acciones derivadas de relaciones de arrendamiento.',
    icon: '⌂',
  },
];

const steps = [
  ['01', 'Cuéntanos tu caso', 'Selecciona el servicio y comparte los datos esenciales de tu situación.'],
  ['02', 'Validamos tu solicitud', 'Identificamos municipio, materia y la información necesaria para avanzar.'],
  ['03', 'Asignamos a tu abogado', 'Un abogado afiliado y con cobertura adecuada toma tu asunto.'],
  ['04', 'Da seguimiento en línea', 'Consulta documentos, avances, plazos y comunicaciones desde tu expediente.'],
];

const trustPoints = [
  ['Abogados verificados', 'Profesionales afiliados con perfil y cobertura revisados.'],
  ['Seguimiento digital', 'Conoce el avance de tu asunto sin perder la comunicación.'],
  ['Expediente en línea', 'Tus datos y documentos se concentran en un solo lugar.'],
  ['Documentos asistidos por IA', 'Borradores basados en formatos y datos del caso, siempre revisados por un abogado.'],
];

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

export default function Home() {
  return (
    <>
      <Head>
        <title>Abogados IA Pro | Asesoría legal inteligente en Guanajuato</title>
        <meta
          name="description"
          content="Abogados IA Pro conecta tu solicitud jurídica con abogados afiliados y te permite dar seguimiento digital a tu expediente en Guanajuato."
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
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: #fff;
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
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 20px;
          border: 1px solid transparent;
          border-radius: 9px;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 800;
          text-decoration: none;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .pro-button:hover { transform: translateY(-2px); }
        .pro-button-primary { color: #fff; background: var(--pro-navy); box-shadow: 0 12px 22px rgba(7, 26, 53, 0.16); }
        .pro-button-primary:hover { background: #0d315e; box-shadow: 0 16px 26px rgba(7, 26, 53, 0.2); }
        .pro-button-secondary { color: var(--pro-navy); background: #fff; border-color: #c7d4e3; }
        .pro-button-secondary:hover { border-color: var(--pro-gold); }
        .pro-button-gold { color: var(--pro-navy-deep); background: var(--pro-gold); box-shadow: 0 13px 26px rgba(199, 154, 75, 0.28); }
        .pro-button-gold:hover { background: #d5aa60; }

        .pro-hero { position: relative; background: linear-gradient(112deg, #f8f6f2 0%, #f8f6f2 55%, #eef4fb 100%); }
        .pro-hero::before {
          content: '';
          position: absolute;
          right: -180px;
          top: -280px;
          width: 680px;
          height: 680px;
          border: 1px solid rgba(23, 72, 127, 0.1);
          border-radius: 50%;
          box-shadow: 0 0 0 65px rgba(23, 72, 127, 0.035), 0 0 0 130px rgba(23, 72, 127, 0.02);
          pointer-events: none;
        }
        .pro-hero-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(350px, 0.8fr);
          align-items: center;
          gap: 68px;
          min-height: 622px;
          padding: 74px 0 84px;
        }
        .pro-eyebrow { margin: 0 0 17px; color: var(--pro-gold); font-size: 0.71rem; font-weight: 850; letter-spacing: 0.16em; text-transform: uppercase; }
        .pro-hero h1 { max-width: 690px; margin: 0; color: var(--pro-navy); font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.65rem, 5vw, 4.7rem); font-weight: 600; letter-spacing: -0.052em; line-height: 0.99; }
        .pro-hero h1 span { color: var(--pro-blue); }
        .pro-hero-copy { max-width: 590px; margin: 26px 0 31px; color: #52617a; font-size: 1.08rem; line-height: 1.75; }
        .pro-cta-row { display: flex; flex-wrap: wrap; gap: 13px; }
        .pro-assurance { display: flex; flex-wrap: wrap; gap: 18px; margin: 30px 0 0; padding: 0; list-style: none; }
        .pro-assurance li { display: flex; align-items: center; gap: 7px; color: #4d5c73; font-size: 0.81rem; font-weight: 650; }
        .pro-assurance svg { color: var(--pro-gold); }

        .pro-case-card {
          width: min(100%, 430px);
          justify-self: end;
          padding: 26px;
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 20px;
          color: #e8eff8;
          background: linear-gradient(145deg, #0b2a50, #071a35);
          box-shadow: 0 28px 52px rgba(7, 26, 53, 0.22);
        }
        .pro-case-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid rgba(218, 232, 248, 0.15); }
        .pro-case-head span { color: #b6c7dc; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .pro-case-status { padding: 6px 9px; border-radius: 999px; color: #f7e3bb; background: rgba(199, 154, 75, 0.16); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; }
        .pro-case-title { margin: 20px 0 4px; color: #fff; font-size: 1.24rem; font-weight: 760; }
        .pro-case-meta { margin: 0; color: #aec0d5; font-size: 0.83rem; }
        .pro-case-list { display: grid; gap: 12px; margin: 23px 0 24px; }
        .pro-case-item { display: flex; align-items: center; gap: 11px; padding: 12px 13px; border: 1px solid rgba(210, 226, 242, 0.12); border-radius: 10px; background: rgba(255, 255, 255, 0.045); }
        .pro-case-item-icon { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 7px; color: #f6dfb2; background: rgba(199, 154, 75, 0.17); font-size: 0.77rem; }
        .pro-case-item strong { display: block; color: #edf4fb; font-size: 0.77rem; }
        .pro-case-item small { display: block; margin-top: 3px; color: #a5bad1; font-size: 0.68rem; }
        .pro-case-footer { display: flex; align-items: center; justify-content: space-between; color: #bdcde0; font-size: 0.74rem; }
        .pro-case-progress { width: 106px; height: 5px; overflow: hidden; border-radius: 99px; background: rgba(255, 255, 255, 0.14); }
        .pro-case-progress::after { content: ''; display: block; width: 68%; height: 100%; border-radius: inherit; background: var(--pro-gold); }

        .pro-section { padding: 104px 0; }
        .pro-section-heading { max-width: 690px; margin-bottom: 43px; }
        .pro-kicker { margin: 0 0 12px; color: var(--pro-gold); font-size: 0.71rem; font-weight: 850; letter-spacing: 0.15em; text-transform: uppercase; }
        .pro-section-heading h2 { max-width: 620px; margin: 0; color: var(--pro-navy); font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 3.5vw, 3.2rem); font-weight: 600; letter-spacing: -0.042em; line-height: 1.05; }
        .pro-section-heading p { max-width: 610px; margin: 17px 0 0; color: var(--pro-muted); font-size: 1rem; line-height: 1.72; }

        .pro-service-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .pro-service-card { min-height: 266px; display: flex; flex-direction: column; padding: 25px; border: 1px solid var(--pro-line); border-radius: 15px; background: #fff; box-shadow: 0 10px 25px rgba(14, 42, 75, 0.045); transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease; }
        .pro-service-card:hover { transform: translateY(-5px); border-color: #c7aa78; box-shadow: 0 16px 32px rgba(14, 42, 75, 0.1); }
        .pro-service-icon { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 22px; border-radius: 11px; color: var(--pro-blue); background: var(--pro-blue-soft); font-family: Georgia, "Times New Roman", serif; font-size: 1.5rem; }
        .pro-service-card h3 { margin: 0; color: var(--pro-navy); font-size: 1.04rem; font-weight: 800; }
        .pro-service-card p { margin: 12px 0 24px; color: var(--pro-muted); font-size: 0.86rem; line-height: 1.65; }
        .pro-service-link { display: inline-flex; align-items: center; gap: 6px; margin-top: auto; color: var(--pro-blue); font-size: 0.82rem; font-weight: 800; text-decoration: none; }

        .pro-how { background: #fff; border-top: 1px solid #e8edf3; border-bottom: 1px solid #e8edf3; }
        .pro-step-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; border: 1px solid var(--pro-line); border-radius: 16px; overflow: hidden; }
        .pro-step { min-height: 242px; padding: 28px; border-right: 1px solid var(--pro-line); background: #fff; }
        .pro-step:last-child { border-right: 0; }
        .pro-step-number { color: var(--pro-gold); font-size: 0.78rem; font-weight: 850; letter-spacing: 0.14em; }
        .pro-step h3 { margin: 34px 0 12px; color: var(--pro-navy); font-size: 1.05rem; }
        .pro-step p { margin: 0; color: var(--pro-muted); font-size: 0.86rem; line-height: 1.65; }

        .pro-coverage-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(330px, 0.75fr); align-items: center; gap: 72px; }
        .pro-coverage-note { display: flex; align-items: flex-start; gap: 13px; max-width: 560px; padding: 17px 19px; border-left: 3px solid var(--pro-gold); color: #53627a; background: #fffdf9; font-size: 0.87rem; line-height: 1.6; }
        .pro-coverage-note svg { flex: 0 0 auto; margin-top: 2px; color: var(--pro-gold); }
        .pro-map-card { position: relative; min-height: 353px; overflow: hidden; padding: 30px; border-radius: 20px; color: #fff; background: linear-gradient(145deg, #0d315d, #071a35); box-shadow: 0 24px 45px rgba(7, 26, 53, 0.2); }
        .pro-map-card::before, .pro-map-card::after { content: ''; position: absolute; border: 1px solid rgba(199, 154, 75, 0.24); border-radius: 50%; }
        .pro-map-card::before { width: 350px; height: 350px; right: -112px; top: -78px; }
        .pro-map-card::after { width: 220px; height: 220px; left: -90px; bottom: -108px; }
        .pro-map-kicker, .pro-map-card h3, .pro-map-card p, .pro-city-list { position: relative; z-index: 1; }
        .pro-map-kicker { margin: 0; color: #f4dba9; font-size: 0.69rem; font-weight: 850; letter-spacing: 0.15em; text-transform: uppercase; }
        .pro-map-card h3 { max-width: 270px; margin: 18px 0 12px; font-family: Georgia, "Times New Roman", serif; font-size: 2rem; font-weight: 600; letter-spacing: -0.03em; line-height: 1.05; }
        .pro-map-card p { max-width: 300px; margin: 0; color: #bfd0e3; font-size: 0.88rem; line-height: 1.65; }
        .pro-city-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 30px; }
        .pro-city-list span { padding: 7px 10px; border: 1px solid rgba(255, 255, 255, 0.17); border-radius: 999px; color: #e7eff8; background: rgba(255, 255, 255, 0.06); font-size: 0.71rem; font-weight: 700; }

        .pro-trust { color: #fff; background: var(--pro-navy); }
        .pro-trust .pro-kicker { color: #eccd91; }
        .pro-trust .pro-section-heading h2 { color: #fff; }
        .pro-trust .pro-section-heading p { color: #b8c7da; }
        .pro-trust-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .pro-trust-card { min-height: 187px; padding: 24px; border: 1px solid rgba(218, 232, 248, 0.16); border-radius: 14px; background: rgba(255, 255, 255, 0.045); }
        .pro-trust-card svg { color: var(--pro-gold); }
        .pro-trust-card h3 { margin: 24px 0 9px; color: #fff; font-size: 0.97rem; }
        .pro-trust-card p { margin: 0; color: #b9c8db; font-size: 0.81rem; line-height: 1.62; }

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
        .pro-footer-placeholder { opacity: 0.68; }
        .pro-socials { display: flex; gap: 8px; margin-top: 15px; }
        .pro-social { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(215, 229, 246, 0.18); border-radius: 50%; color: #c8d7e9; background: rgba(255, 255, 255, 0.04); font-size: 0.72rem; font-weight: 850; }
        .pro-footer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 20px; border-top: 1px solid rgba(215, 229, 246, 0.13); color: #8193aa; font-size: 0.72rem; }

        @media (max-width: 1000px) {
          .pro-navigation { gap: 15px; }
          .pro-hero-grid { gap: 42px; }
          .pro-service-grid, .pro-trust-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pro-coverage-wrap { gap: 42px; }
        }
        @media (max-width: 780px) {
          .pro-shell { width: min(100% - 36px, 620px); }
          .pro-header { min-height: auto; padding: 18px 0; flex-wrap: wrap; }
          .pro-navigation { order: 3; width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; justify-content: stretch; }
          .pro-navigation a { white-space: normal; }
          .pro-header-actions { margin-left: auto; }
          .pro-header-actions .pro-button { min-height: 40px; padding: 0 14px; font-size: 0.8rem; }
          .pro-hero-grid { grid-template-columns: 1fr; gap: 42px; min-height: auto; padding: 54px 0 66px; }
          .pro-case-card { justify-self: start; }
          .pro-step-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pro-step:nth-child(2) { border-right: 0; }
          .pro-step:nth-child(-n + 2) { border-bottom: 1px solid var(--pro-line); }
          .pro-coverage-wrap { grid-template-columns: 1fr; }
          .pro-map-card { max-width: 470px; }
          .pro-final-content { align-items: flex-start; flex-direction: column; }
          .pro-footer-grid { grid-template-columns: 1fr 1fr; }
          .pro-footer-grid > :first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 540px) {
          .pro-shell { width: min(100% - 32px, 460px); }
          .pro-brand-title { font-size: 0.94rem; }
          .pro-brand-subtitle { font-size: 0.57rem; }
          .pro-header-actions .pro-button-secondary { display: none; }
          .pro-hero h1 { font-size: clamp(2.38rem, 12vw, 3.25rem); }
          .pro-hero-copy { font-size: 0.97rem; }
          .pro-cta-row { display: grid; width: 100%; }
          .pro-cta-row .pro-button { width: 100%; }
          .pro-assurance { display: grid; gap: 11px; }
          .pro-section { padding: 76px 0; }
          .pro-service-grid, .pro-trust-grid, .pro-step-grid { grid-template-columns: 1fr; }
          .pro-step { min-height: 0; border-right: 0; border-bottom: 1px solid var(--pro-line); }
          .pro-step:last-child { border-bottom: 0; }
          .pro-step h3 { margin-top: 22px; }
          .pro-map-card { min-height: 330px; padding: 25px; }
          .pro-footer-grid { grid-template-columns: 1fr; }
          .pro-footer-grid > :first-child { grid-column: auto; }
          .pro-footer-bottom { align-items: flex-start; flex-direction: column; }
        }
      `}</style>

      <main className="pro-page">
        <section className="pro-hero" aria-labelledby="inicio">
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
                <a href="#servicios">Servicios</a>
                <a href="#como-funciona">Cómo funciona</a>
                <a href="#cobertura">Cobertura</a>
                <Link href="/cliente/login">Acceso clientes</Link>
              </nav>

              <div className="pro-header-actions">
                <Link className="pro-button pro-button-secondary" href="/login">Acceso abogados</Link>
                <Link className="pro-button pro-button-primary" href="/cliente/cuestionario">Solicitar servicio</Link>
              </div>
            </header>

            <div className="pro-hero-grid">
              <div>
                <p className="pro-eyebrow">Servicios legales con acompañamiento humano</p>
                <h1 id="inicio">Asesoría legal <span>inteligente</span> en Guanajuato.</h1>
                <p className="pro-hero-copy">
                  Cuéntanos qué necesitas. Organizamos tu solicitud, te conectamos con un abogado afiliado y te damos seguimiento digital durante cada etapa de tu asunto.
                </p>
                <div className="pro-cta-row">
                  <Link className="pro-button pro-button-gold" href="/cliente/cuestionario">
                    Solicitar servicio <ArrowIcon />
                  </Link>
                  <Link className="pro-button pro-button-secondary" href="/login">Acceso abogados</Link>
                </div>
                <ul className="pro-assurance" aria-label="Beneficios principales">
                  <li><CheckIcon /> Solicitud guiada</li>
                  <li><CheckIcon /> Abogado asignado</li>
                  <li><CheckIcon /> Seguimiento en línea</li>
                </ul>
              </div>

              <aside className="pro-case-card" aria-label="Vista ilustrativa de un expediente digital">
                <div className="pro-case-head">
                  <span>Expediente digital</span>
                  <b className="pro-case-status">En seguimiento</b>
                </div>
                <h2 className="pro-case-title">Tu asunto, organizado</h2>
                <p className="pro-case-meta">Información, documentos y siguientes pasos en un solo lugar.</p>
                <div className="pro-case-list">
                  <div className="pro-case-item">
                    <span className="pro-case-item-icon">01</span>
                    <span><strong>Solicitud validada</strong><small>Datos y documentos iniciales</small></span>
                  </div>
                  <div className="pro-case-item">
                    <span className="pro-case-item-icon">02</span>
                    <span><strong>Abogado asignado</strong><small>Cobertura según municipio y materia</small></span>
                  </div>
                  <div className="pro-case-item">
                    <span className="pro-case-item-icon">03</span>
                    <span><strong>Documentos en revisión</strong><small>Preparación asistida y revisión profesional</small></span>
                  </div>
                </div>
                <div className="pro-case-footer">
                  <span>Seguimiento claro y seguro</span>
                  <span className="pro-case-progress" aria-hidden="true" />
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="servicios" className="pro-section" aria-labelledby="servicios-title">
          <div className="pro-shell">
            <div className="pro-section-heading">
              <p className="pro-kicker">Servicios iniciales</p>
              <h2 id="servicios-title">Atención legal con una ruta clara desde el inicio.</h2>
              <p>Selecciona el servicio que más se acerque a tu necesidad. Si tu asunto requiere valoración previa, la plataforma te guiará para reunir la información necesaria.</p>
            </div>
            <div className="pro-service-grid">
              {services.map((service) => (
                <article className="pro-service-card" key={service.name}>
                  <span className="pro-service-icon" aria-hidden="true">{service.icon}</span>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <Link className="pro-service-link" href="/cliente/cuestionario">Solicitar orientación <ArrowIcon /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="pro-section pro-how" aria-labelledby="como-funciona-title">
          <div className="pro-shell">
            <div className="pro-section-heading">
              <p className="pro-kicker">Cómo funciona</p>
              <h2 id="como-funciona-title">Tecnología para ordenar el proceso. Personas para llevar tu caso.</h2>
            </div>
            <div className="pro-step-grid">
              {steps.map(([number, title, description]) => (
                <article className="pro-step" key={number}>
                  <span className="pro-step-number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cobertura" className="pro-section" aria-labelledby="cobertura-title">
          <div className="pro-shell pro-coverage-wrap">
            <div>
              <div className="pro-section-heading">
                <p className="pro-kicker">Cobertura en Guanajuato</p>
                <h2 id="cobertura-title">Empezamos cerca, con atención adecuada para cada asunto.</h2>
                <p>Abogados IA Pro valida la cobertura de cada solicitud por municipio, materia y disponibilidad profesional antes de confirmar la atención.</p>
              </div>
              <div className="pro-coverage-note">
                <CheckIcon />
                <span>La disponibilidad se confirma al revisar tu solicitud. Así evitamos prometer un servicio sin contar con el abogado y la cobertura adecuados.</span>
              </div>
            </div>
            <aside className="pro-map-card" aria-label="Cobertura inicial en Guanajuato">
              <p className="pro-map-kicker">Cobertura inicial</p>
              <h3>Guanajuato, cerca de ti.</h3>
              <p>Una red profesional que crece municipio por municipio, con seguimiento desde la plataforma.</p>
              <div className="pro-city-list" aria-label="Municipios de referencia">
                <span>León</span><span>Guanajuato</span><span>Irapuato</span><span>Celaya</span><span>San Miguel de Allende</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="pro-section pro-trust" aria-labelledby="confianza-title">
          <div className="pro-shell">
            <div className="pro-section-heading">
              <p className="pro-kicker">Confianza y control</p>
              <h2 id="confianza-title">Una experiencia legal más clara, sin perder el criterio profesional.</h2>
              <p>La tecnología ayuda a ordenar la información y preparar documentos; el análisis jurídico y las decisiones importantes siguen a cargo de tu abogado.</p>
            </div>
            <div className="pro-trust-grid">
              {trustPoints.map(([title, description]) => (
                <article className="pro-trust-card" key={title}>
                  <CheckIcon />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pro-final-cta" aria-labelledby="cta-title">
          <div className="pro-shell pro-final-content">
            <div>
              <h2 id="cta-title">Tu solicitud legal puede empezar hoy.</h2>
              <p>Comparte los datos iniciales de tu caso y conoce el siguiente paso con claridad.</p>
            </div>
            <Link className="pro-button pro-button-primary" href="/cliente/cuestionario">Solicitar servicio <ArrowIcon /></Link>
          </div>
        </section>

        <footer className="pro-footer" id="contacto">
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
                <p className="pro-footer-copy">Una plataforma para solicitar atención legal, organizar tu expediente y mantenerte informado durante el proceso.</p>
              </div>
              <div>
                <p className="pro-footer-title">Atención y acceso</p>
                <ul className="pro-footer-list">
                  <li><Link href="/cliente/cuestionario">Solicitar servicio</Link></li>
                  <li><Link href="/cliente/login">Acceso clientes</Link></li>
                  <li><Link href="/login">Acceso abogados</Link></li>
                  <li><a href="#servicios">Servicios iniciales</a></li>
                </ul>
              </div>
              <div>
                <p className="pro-footer-title">Información</p>
                <ul className="pro-footer-list">
                  <li><span className="pro-footer-placeholder">Aviso de privacidad próximamente</span></li>
                  <li><span className="pro-footer-placeholder">Términos de servicio próximamente</span></li>
                  <li><span className="pro-footer-placeholder">Redes sociales próximamente</span></li>
                </ul>
                <div className="pro-socials" aria-label="Redes sociales próximamente">
                  <span className="pro-social" aria-hidden="true">in</span>
                  <span className="pro-social" aria-hidden="true">ig</span>
                  <span className="pro-social" aria-hidden="true">f</span>
                </div>
              </div>
            </div>
            <div className="pro-footer-bottom">
              <span>© {new Date().getFullYear()} Abogados IA Pro. Todos los derechos reservados.</span>
              <span>Guanajuato, México</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
