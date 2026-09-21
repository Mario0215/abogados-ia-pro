import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

type Props = {
  children: React.ReactNode;
  userName?: string;
  role?: string;
};

const NAV_ICONS: Record<string, React.ReactElement> = {
  panel: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  expedientes: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  agenda: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  plantillas: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  chat: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

const NAV = [
  { id: 'panel',        href: '/dashboard',  label: 'Inicio' },
  { id: 'expedientes',  href: '/mis-casos',  label: 'Expedientes' },
  { id: 'agenda',       href: '/agenda',     label: 'Agenda' },
  { id: 'plantillas',   href: '/plantillas', label: 'Plantillas' },
];

export default function AppLayout({ children, userName, role }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const p = router.pathname;

  const isActive = (href: string) =>
    href === '/dashboard' ? p === '/dashboard' : p.startsWith(href);

  return (
    <>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf9f7; font-family: 'Georgia', serif; color: #1a1a1a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #faf9f7; }
        ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 3px; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #9b9b9b !important; }
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 3px solid #896419 !important;
          outline-offset: 3px;
        }
        .app-mobile-menu, .app-sidebar-backdrop { display: none; }
        @media (max-width: 767px) {
          .app-sidebar {
            width: min(280px, calc(100vw - 48px)) !important;
            transform: translateX(-105%);
            transition: transform 0.2s ease;
            box-shadow: 12px 0 30px rgba(0, 0, 0, 0.18);
          }
          .app-sidebar--open { transform: translateX(0); }
          .app-main { margin-left: 0 !important; padding-top: 64px; }
          .app-mobile-menu {
            display: inline-flex;
            position: fixed;
            top: 12px;
            left: 12px;
            z-index: 30;
            align-items: center;
            gap: 8px;
            min-height: 40px;
            padding: 0 12px;
            border: 1px solid #dedede;
            border-radius: 8px;
            background: #ffffff;
            color: #1a1a1a;
            font: 600 13px/1 Georgia, serif;
            cursor: pointer;
            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
          }
          .app-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 19;
            border: 0;
            background: rgba(0, 0, 0, 0.35);
            cursor: pointer;
          }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#faf9f7', color: '#1a1a1a', fontFamily: 'Georgia, serif' }}>

        <button
          type="button"
          className="app-mobile-menu"
          aria-controls="app-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
        {menuOpen && (
          <button
            type="button"
            className="app-sidebar-backdrop"
            aria-label="Cerrar navegación"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside id="app-navigation" className={`app-sidebar${menuOpen ? ' app-sidebar--open' : ''}`} style={{
          width: 240,
          background: '#f7f7f8',
          borderRight: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 20,
        }}>
          {/* Logo */}
          <div style={{ padding: '28px 24px 22px', borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ fontSize: 11, color: '#9b9b9b', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Asistente del</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3d3d3d', letterSpacing: 1 }}>Abogado</div>
            <div style={{ fontSize: 11, color: '#9b9b9b', marginTop: 3 }}>Cymnova A.C.</div>
          </div>

          {/* Nav principal */}
          <nav aria-label="Navegación principal" style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {NAV.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.id} href={item.href} onClick={() => setMenuOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 8,
                  color: active ? '#3d3d3d' : '#6b6b6b',
                  background: active ? '#efefef' : 'transparent',
                  fontSize: 14, textDecoration: 'none',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ display: 'flex', flexShrink: 0 }}>{NAV_ICONS[item.id]}</span>
                  {item.label}
                </Link>
              );
            })}

            <div style={{ height: 1, background: '#e5e5e5', margin: '10px 2px' }} />

            <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 8,
              color: '#6b6b6b', fontSize: 14, textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              <span style={{ display: 'flex', flexShrink: 0 }}>{NAV_ICONS.chat}</span>
              Consulta Legal
            </Link>
          </nav>

          {/* Footer */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e5e5' }}>
            {role === 'ADMIN' && (
              <Link href="/admin" onClick={() => setMenuOpen(false)} style={{
                display: 'block', textAlign: 'center',
                padding: '8px', marginBottom: 10, borderRadius: 8,
                background: '#efefef', color: '#1a1a1a',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                border: '1px solid #e0e0e0',
              }}>
                ⚙️ Admin
              </Link>
            )}
            {userName && (
              <div style={{
                fontSize: 12, color: '#9b9b9b', marginBottom: 8,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {userName}
              </div>
            )}
            <Link href="/api/auth/logout" style={{
              display: 'block', textAlign: 'center',
              padding: '9px', borderRadius: 8,
              background: '#f5f5f5', color: '#6b6b6b',
              fontSize: 13, textDecoration: 'none',
              border: '1px solid #e5e5e5',
            }}>
              Cerrar sesión
            </Link>
          </div>
        </aside>

        {/* ── Contenido principal ── */}
        <main className="app-main" style={{ marginLeft: 240, flex: 1, minHeight: '100vh' }}>
          {children}
        </main>

      </div>
    </>
  );
}
