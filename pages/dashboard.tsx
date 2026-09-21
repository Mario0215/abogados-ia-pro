import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useEffect, useRef, useState } from 'react';
import { getAuthFromCookies } from '../lib/auth';
import { prisma } from '../lib/prisma';

type CasoAsignado = { id: string; expediente: string; intent: string | null; ciudad: string | null; status: string; estadoAsignacion: string; clientName: string | null; plazos: { titulo: string; vence: string }[]; matter: string; courtNumber: string | null; courtType: string | null; expedienteReal: string | null };

const STATUS_PRO_LABEL_DASH: Record<string, { label: string; color: string; bg: string }> = {
  NUEVO:         { label: 'Nuevo',         color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  ASIGNADO:      { label: 'Asignado',      color: '#818cf8', bg: 'rgba(99,102,241,0.14)' },
  EN_REVISION:   { label: 'En revisión',   color: '#fbbf24', bg: 'rgba(245,158,11,0.14)' },
  EN_REDACCION:  { label: 'En redacción',  color: '#f59e0b', bg: 'rgba(217,119,6,0.14)' },
  DEMANDA_LISTA: { label: 'Demanda lista', color: '#34d399', bg: 'rgba(16,185,129,0.14)' },
  PRESENTADO:    { label: 'Presentado',    color: '#4ade80', bg: 'rgba(34,197,94,0.14)' },
  SEGUIMIENTO:   { label: 'Seguimiento',   color: '#22d3ee', bg: 'rgba(8,145,178,0.14)' },
  CERRADO:       { label: 'Cerrado',       color: '#94a3b8', bg: 'rgba(75,85,99,0.14)' },
  ARCHIVADO:     { label: 'Archivado',     color: '#9ca3af', bg: 'rgba(107,114,128,0.14)' },
};

type Props = {
  name: string;
  email: string;
  role: 'ABOGADO' | 'ADMIN';
  chatLogs: { id: string; summary: string }[];
  casosAsignados: CasoAsignado[];
};

export default function Dashboard({ name, email, role, chatLogs, casosAsignados }: Props) {
  const [selectedCode, setSelectedCode] = useState<'CC_GTO' | 'CPC_GTO' | 'CNPCF' | ''>('');
  const [selectedMatter, setSelectedMatter] = useState('');
  const [chatEnabled, setChatEnabled] = useState(false);
  const [jur, setJur] = useState<'ESTATAL' | 'FEDERAL' | ''>('');
  const [civilMode, setCivilMode] = useState<'CC' | 'CPC' | 'CNPCF' | 'INTEGRAL' | 'JURISPRUDENCIA' | ''>('');
  const [question, setQuestion] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [chatItems, setChatItems] = useState<{ id: string; summary: string }[]>(chatLogs || []);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatViewMode, setChatViewMode] = useState<'question' | 'answer'>('question');
  const [currentChatData, setCurrentChatData] = useState<{ question: string; answer: string } | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);


  const CODES = [
    { key: 'CC_GTO',  label: 'CC GTO',  full: 'Código Civil\nGuanajuato',       jur: 'ESTATAL' as const, matter: 'CIVIL', mode: 'CC'    as const },
    { key: 'CPC_GTO', label: 'CPC GTO', full: 'Cód. Proc. Civiles\nGuanajuato', jur: 'ESTATAL' as const, matter: 'CIVIL', mode: 'CPC'   as const },
    { key: 'CNPCF',   label: 'CNPCF',   full: 'Cód. Nacional\nProc. Civiles',   jur: 'FEDERAL' as const, matter: 'CIVIL', mode: 'CNPCF' as const },
  ] as const;

  function newChat() {
    setMobileMenuOpen(false);
    setQuestion('');
    setInfo('');
    setJur('');
    setSelectedMatter('');
    setCivilMode('');
    setSelectedCode('');
    setChatEnabled(false);
    setSelectedChatId(null);
    setCurrentChatData(null);
    setChatViewMode('question');
    textareaRef.current?.focus();
  }

  function onSelectCode(code: typeof CODES[number]) {
    setSelectedCode(code.key);
    setJur(code.jur);
    setSelectedMatter(code.matter);
    setCivilMode(code.mode);
    setChatEnabled(true);
    setInfo('');
    setSelectedChatId(null);
  }

  async function openChat(id: string) {
    setMobileMenuOpen(false);
    if (selectedChatId === id && currentChatData) {
      const next = chatViewMode === 'question' ? 'answer' : 'question';
      setChatViewMode(next);
      setInfo(next === 'question' ? currentChatData.question : currentChatData.answer);
      return;
    }
    try {
      const res = await fetch(`/api/chat/${id}`);
      const data = await res.json();
      if (res.ok) {
        const fetched = { question: data.question || '', answer: data.answer || '' };
        setCurrentChatData(fetched);
        setSelectedChatId(id);
        setChatViewMode('answer');
        setInfo(fetched.answer);
        if (data.matter) setSelectedMatter(data.matter);
        if (data.jurisdiccion) setJur(data.jurisdiccion as any);
        setChatEnabled(true);
      }
    } catch { setInfo('Error de red'); }
  }

  async function sendQuestion() {
    if (!chatEnabled || !question.trim() || !selectedMatter || !jur) return;
    if (selectedMatter === 'CIVIL' && !civilMode) return;
    setSending(true);
    setInfo('');
    try {
      let effSub: string | undefined;
      let effIntegral = false;
      if (selectedMatter === 'CIVIL' && jur === 'ESTATAL') {
        if (civilMode === 'CPC') effSub = 'Procesal/Adjetivo';
        if (civilMode === 'CC') effSub = 'Sustantivo';
        if (civilMode === 'INTEGRAL') effIntegral = true;
        if (civilMode === 'JURISPRUDENCIA') effSub = 'JURISPRUDENCIA';
      }
      if (selectedMatter === 'CIVIL' && jur === 'FEDERAL') {
        if (civilMode === 'CNPCF') effSub = 'CNPCF';
        if (civilMode === 'INTEGRAL') effIntegral = true;
        if (civilMode === 'JURISPRUDENCIA') effSub = 'JURISPRUDENCIA';
      }
      const ragRes = await fetch('/api/rag/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, matter: selectedMatter, submatter: effSub, jurisdiccion: jur, topK: 5, integral: effIntegral, mode: civilMode || undefined }),
      });
      const ragData = await ragRes.json();
      if (ragRes.ok) {
        setInfo(String(ragData.answer || ''));
        setChatItems(prev => [{ id: String(ragData.id || Date.now()), summary: summarizeQ(question) }, ...prev]);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, matter: selectedMatter, jurisdiccion: jur }),
        });
        const data = await res.json();
        if (res.ok) {
          setInfo(data.answer || data.message || '');
          setChatItems(prev => [{ id: String(data.id), summary: summarizeQ(question) }, ...prev]);
        } else { setInfo(data.error || 'Error'); }
      }
      setQuestion('');
    } catch { setInfo('Error de red'); }
    finally { setSending(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuestion(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  const filteredChats = chatItems
    .filter(c => !chatSearch || c.summary.toLowerCase().includes(chatSearch.toLowerCase()))
    .slice(0, 10);

  const canSend = chatEnabled && !!selectedCode && question.trim() && !sending;

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <>
      <Head><title>Abogados IA</title></Head>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf9f7; color: #1a1a1a; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .ans { animation: fadeIn 0.3s ease; }
        textarea { outline: none; }
        input { outline: none; }
        .sidebar-btn:hover { background: #efefef !important; }
        .chat-item:hover { background: #efefef !important; }
        .chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }
        .dashboard-shell :focus-visible {
          outline: 3px solid #b45309;
          outline-offset: 3px;
        }
        .mobile-menu-toggle, .mobile-menu-overlay { display: none; }

        @media (max-width: 767px) {
          .dashboard-shell { height: 100dvh !important; }
          .dashboard-sidebar {
            position: fixed !important;
            inset: 0 auto 0 0;
            width: min(280px, 86vw) !important;
            transform: translateX(-105%);
            transition: transform 0.2s ease;
            z-index: 10001;
            box-shadow: 12px 0 28px rgba(0, 0, 0, 0.16);
          }
          .dashboard-sidebar[data-open='true'] { transform: translateX(0); }
          .dashboard-main { min-width: 0; padding-top: 56px; }
          .mobile-menu-toggle {
            display: inline-flex;
            position: fixed;
            top: 10px;
            left: 10px;
            width: 40px;
            height: 40px;
            align-items: center;
            justify-content: center;
            border: 1px solid #3d3d3d;
            border-radius: 8px;
            background: #ffffff;
            color: #1a1a1a;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
            z-index: 10002;
          }
          .mobile-menu-overlay {
            display: block;
            position: fixed;
            inset: 0;
            border: 0;
            background: rgba(0, 0, 0, 0.35);
            cursor: pointer;
            z-index: 10000;
          }
        }
      `}</style>

      <div className="dashboard-shell" style={{ display: 'flex', height: '100vh', background: '#faf9f7', overflow: 'hidden' }}>

        {mobileMenuOpen && (
          <button
            type="button"
            className="mobile-menu-overlay"
            aria-label="Cerrar menú de navegación"
            onClick={() => {
              setMobileMenuOpen(false);
              mobileMenuButtonRef.current?.focus();
            }}
          />
        )}

        <button
          ref={mobileMenuButtonRef}
          type="button"
          className="mobile-menu-toggle"
          aria-controls="dashboard-sidebar"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          onClick={() => setMobileMenuOpen(open => !open)}
        >
          <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
        </button>

        {/* ── Sidebar ── */}
        <aside id="dashboard-sidebar" className="dashboard-sidebar" data-open={mobileMenuOpen} style={{
          width: 260, background: '#f7f7f8', borderRight: '1px solid #e5e5e5',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* Brand */}
          <div style={{ padding: '20px 16px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>Abogados IA</div>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 3, lineHeight: 1.3, fontWeight: 500 }}>Asistente Civil en Guanajuato</div>
          </div>

          {/* + Nuevo Chat */}
          <div style={{ padding: '0 10px 6px' }}>
            <button className="sidebar-btn" onClick={newChat} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: '1px solid #3d3d3d', borderRadius: 8,
              padding: '9px 12px', color: '#1a1a1a', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s', textAlign: 'left',
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Nuevo Chat
            </button>
          </div>

          {/* Buscar Chat */}
          <div style={{ padding: '0 10px 10px' }}>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9b9b9b" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={chatSearch}
                onChange={e => setChatSearch(e.target.value)}
                placeholder="Buscar Chat"
                style={{
                  width: '100%', background: 'transparent', border: '1px solid #3d3d3d',
                  borderRadius: 8, padding: '8px 12px 8px 28px', color: '#1a1a1a',
                  fontSize: 13, transition: 'border-color 0.15s',
                }}
              />
            </div>
          </div>

          {/* Nav links */}
          <div style={{ padding: '0 10px 4px' }}>
            <Link href="/mis-casos" className="sidebar-btn" onClick={() => setMobileMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, color: '#1a1a1a',
              fontSize: 13, textDecoration: 'none', transition: 'background 0.15s',
              marginBottom: 2,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg> Mi Asistente
            </Link>
            <Link href="/agenda" className="sidebar-btn" onClick={() => setMobileMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, color: '#1a1a1a',
              fontSize: 13, textDecoration: 'none', transition: 'background 0.15s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg> Mi Agenda
            </Link>
          </div>

          <div style={{ height: 1, background: '#efefef', margin: '8px 16px' }} />

          {/* Chats recientes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
            {filteredChats.length > 0 && (
              <div style={{ fontSize: 11, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 4px 8px' }}>Recientes</div>
            )}
            {filteredChats.map(c => (
              <button
                key={c.id}
                className="chat-item"
                onClick={() => openChat(c.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', borderRadius: 8, border: 'none',
                  background: selectedChatId === c.id ? '#e8e8e5' : 'transparent',
                  color: '#1a1a1a',
                  fontSize: 13, cursor: 'pointer',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'background 0.1s', marginBottom: 1,
                }}
              >
                {c.summary}
              </button>
            ))}
            {filteredChats.length === 0 && chatSearch && (
              <div style={{ fontSize: 12, color: '#9b9b9b', padding: '8px 12px' }}>Sin resultados</div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2a' }}>
            {role === 'ADMIN' && (
              <Link href="/admin" onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontSize: 12, color: '#6b6b6b', textDecoration: 'none', marginBottom: 6 }}>⚙️ Admin</Link>
            )}
            <div style={{ fontSize: 12, color: '#9b9b9b', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            <Link href="/api/auth/logout" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: 12, color: '#9b9b9b', textDecoration: 'none' }}>Cerrar sesión</Link>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="dashboard-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>

          {/* Scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!info ? (
              /* Greeting + input centrados */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <h1 style={{ fontSize: 34, fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px', textAlign: 'center' }}>
                  Hola, Lic. {name}
                </h1>
                <p style={{ fontSize: 16, color: '#6b6b6b', margin: '0 0 32px', textAlign: 'center' }}>
                  ¿En qué te puedo ayudar hoy?
                </p>

                {/* Input centrado */}
                <div style={{ width: '100%', maxWidth: 760, padding: '0 20px' }}>
                  <div style={{
                    background: '#f5f5f5', border: '1px solid #424242', borderRadius: 16,
                    padding: '12px 12px 12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end',
                    marginBottom: 14,
                  }}>
                    <textarea
                      ref={textareaRef}
                      value={question}
                      onChange={autoResize}
                      onKeyDown={handleKey}
                      rows={1}
                      disabled={sending}
                      placeholder={
                        !selectedCode ? 'Selecciona un código abajo...' : 'Escribe tu consulta legal...'
                      }
                      style={{
                        flex: 1, background: 'transparent', border: 'none',
                        color: '#1a1a1a', fontSize: 15, resize: 'none',
                        fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto',
                      }}
                    />
                    <button type="button" aria-label={sending ? 'Enviando consulta' : 'Enviar consulta'} onClick={sendQuestion} disabled={!canSend} style={{
                      background: canSend ? '#1a1a1a' : '#e5e5e5',
                      color: canSend ? '#ffffff' : '#9b9b9b',
                      border: 'none', borderRadius: 10, width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: canSend ? 'pointer' : 'not-allowed',
                      flexShrink: 0, fontSize: 18, fontWeight: 700, transition: 'all 0.15s',
                    }}>
                      {sending ? '·' : '↑'}
                    </button>
                  </div>

                  {/* 3 tarjetas de código */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#9b9b9b', width: '100%', textAlign: 'center', marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Selecciona Jurisdicción</div>
                    {CODES.map(c => (
                      <button key={c.key} onClick={() => onSelectCode(c)} style={{
                        background: selectedCode === c.key ? '#e8e8e5' : '#f5f5f5',
                        color: '#1a1a1a',
                        border: `1.5px solid ${selectedCode === c.key ? '#9b9b9b' : '#e0e0e0'}`,
                        borderRadius: 10, padding: '12px 18px', cursor: 'pointer',
                        fontSize: 13, fontWeight: selectedCode === c.key ? 700 : 500,
                        fontFamily: 'inherit',
                        whiteSpace: 'pre-line', textAlign: 'center', lineHeight: 1.4,
                        transition: 'all 0.15s', minWidth: 130,
                      }}>
                        {c.full}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Respuesta */
              <div style={{ flex: 1, padding: '40px 20px 20px' }}>
                <div style={{ maxWidth: 760, margin: '0 auto' }}>
                  <div className="ans" style={{
                    background: '#f5f5f5', borderRadius: 12, padding: '20px 24px',
                    fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', whiteSpace: 'pre-wrap',
                  }}>
                    {info}
                  </div>
                  <button onClick={() => setInfo('')} style={{
                    marginTop: 12, background: 'transparent', border: 'none',
                    color: '#9b9b9b', fontSize: 12, cursor: 'pointer',
                  }}>
                    ← Nueva consulta
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Input fijo al fondo SOLO cuando hay respuesta activa */}
          {info && (
          <div style={{ padding: '16px 20px 24px', maxWidth: 780, margin: '0 auto', width: '100%' }}>

            {/* Input box */}
            <div style={{
              background: '#f5f5f5', border: '1px solid #3d3d3d', borderRadius: 16,
              padding: '12px 12px 12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end',
              marginBottom: 14, transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={textareaRef}
                value={question}
                onChange={autoResize}
                onKeyDown={handleKey}
                rows={1}
                disabled={sending}
                placeholder={
                  !jur ? 'Selecciona jurisdicción abajo...'
                  : !selectedMatter ? 'Selecciona materia...'
                  : selectedMatter === 'CIVIL' && !civilMode ? 'Selecciona modo de consulta...'
                  : 'Escribe tu consulta legal...'
                }
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: '#1a1a1a', fontSize: 15, resize: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 160,
                  overflowY: 'auto',
                }}
              />
              <button
                type="button"
                aria-label={sending ? 'Enviando consulta' : 'Enviar consulta'}
                onClick={sendQuestion}
                disabled={!canSend}
                style={{
                  background: canSend ? '#1a1a1a' : '#e5e5e5',
                  color: canSend ? '#ffffff' : '#9b9b9b',
                  border: 'none', borderRadius: 10, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  flexShrink: 0, fontSize: 18, fontWeight: 700,
                  transition: 'all 0.15s',
                }}
              >
                {sending ? '·' : '↑'}
              </button>
            </div>

            {/* 3 tarjetas de código (versión compacta bajo el input) */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CODES.map(c => (
                <button key={c.key} onClick={() => onSelectCode(c)} style={{
                  background: selectedCode === c.key ? '#e8e8e5' : '#f5f5f5',
                  color: '#1a1a1a',
                  border: `1.5px solid ${selectedCode === c.key ? '#9b9b9b' : '#e0e0e0'}`,
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 12, fontWeight: selectedCode === c.key ? 600 : 400,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Casos asignados — solo visible para ABOGADO */}
          {role === 'ABOGADO' && (
            <div style={{ marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase' }}>Mis casos asignados</div>
                <Link href="/mis-casos" style={{ fontSize: 12, color: '#c9a84c', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid rgba(201,168,76,0.3)', paddingBottom: 1 }}>Mis expedientes →</Link>
              </div>
              {casosAsignados.length === 0 ? (
                <div style={{ background: '#111827', border: '1px dashed #334155', borderRadius: 10, padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Aún no tienes expedientes asignados. El ADMIN asignará los casos correspondientes a tu especialidad.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {casosAsignados.map(c => {
                    const st = STATUS_PRO_LABEL_DASH[c.status] || { label: c.status || '—', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' };
                    const juzgado = [c.courtType, c.courtNumber].filter(Boolean).join(' ');
                    return (
                      <Link key={c.id} href={`/mis-casos/${c.id}`} style={{ display: 'block', background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '16px 20px', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: '#64748b', letterSpacing: 0.5 }}>{c.expediente}</span>
                              {c.expedienteReal && <span style={{ fontSize: 11, color: '#475569' }}>· No. J. {c.expedienteReal}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 2 }}>{c.clientName || '—'}</div>
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <span>{c.matter}</span>
                              {c.ciudad && <span>· {c.ciudad}</span>}
                              {juzgado && <span>· Juz. {juzgado}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: c.estadoAsignacion === 'ASIGNADO' ? 'rgba(201,168,76,0.15)' : 'rgba(96,165,250,0.15)', color: c.estadoAsignacion === 'ASIGNADO' ? '#c9a84c' : '#60a5fa' }}>
                              {c.estadoAsignacion || 'Sin asignar'}
                            </span>
                            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {c.intent && <span style={{ color: '#94a3b8' }}>{c.intent}</span>}
                          {c.plazos.length > 0 && <span style={{ color: '#f59e0b' }}>⏱ {c.plazos[0].titulo} · vence {c.plazos[0].vence}</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </>
  );
}

function summarizeQ(q: string): string {
  try {
    const m = q.trim().match(/art[íi]culo\s+(\d+)/i);
    if (m) return `Artículo ${m[1]}`;
    return q.trim().split(/\s+/).slice(0, 7).join(' ') || 'Chat';
  } catch { return 'Chat'; }
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  try {
    const auth = getAuthFromCookies(req.headers.cookie);
    if (!auth || !['ABOGADO', 'ADMIN'].includes(auth.role)) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    let logs: { id: string; summary: string }[] = [];
    try {
      const raw = await (prisma as any).chatLog.findMany({
        where: { userId: auth.uid },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      logs = raw.map((l: any) => ({ id: l.id, summary: l.summary || summarizeQ(l.question || '') }));
    } catch {}

    // Casos asignados al abogado (solo para rol ABOGADO)
    let casosAsignados: CasoAsignado[] = [];
    if (auth.role === 'ABOGADO') {
      try {
        const raw = await (prisma as any).legalCase.findMany({
          where: { abogadoId: auth.uid, isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            client: { select: { name: true } },
            deadlines: { where: { status: 'PENDIENTE' }, orderBy: { dueDate: 'asc' }, take: 1 },
          },
        });
        casosAsignados = raw.map((c: any) => ({
          id: c.id,
          expediente: c.expediente,
          intent: c.intent || null,
          ciudad: c.ciudad || null,
          status: c.status,
          estadoAsignacion: c.estadoAsignacion,
          clientName: c.client?.name || null,
          matter: c.matter || 'CIVIL',
          courtNumber: c.courtNumber || null,
          courtType: c.courtType || null,
          expedienteReal: c.expedienteReal || null,
          plazos: c.deadlines.map((d: any) => ({ titulo: d.title, vence: new Date(d.dueDate).toLocaleDateString('es-MX') })),
        }));
      } catch {}
    }

    return {
      props: { name: auth.name, email: auth.email || '', role: auth.role, chatLogs: logs, casosAsignados },
    };
  } catch {
    return {
      props: { name: 'Abogado', email: '', role: 'ABOGADO', chatLogs: [], casosAsignados: [] },
    };
  }
};
