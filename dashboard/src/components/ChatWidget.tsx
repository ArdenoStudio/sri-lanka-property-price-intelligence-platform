import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { ChatResponse } from '../api';
import { sendChatMessage } from '../api';

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT      = "#1fb6aa";
const ACCENT_RGB  = "31,182,170";
const STORAGE_KEY  = "propertylk_chat_v1";
const TOOLTIP_KEY  = "propertylk_chat_tooltip_seen";
const genId = () => Math.random().toString(36).slice(2, 10);

type Message = { role: 'user' | 'assistant'; content: string; id: string };

// ─── Icons ────────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const Spinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    style={{ animation: "awSpin .85s linear infinite", display: "block" }}>
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.16)" strokeWidth="2.5"/>
    <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const PropertyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .aw * { box-sizing: border-box; }
  .aw button, .aw textarea { font-family: inherit; }
  .aw button { -webkit-tap-highlight-color: transparent; }

  @keyframes awPanelIn {
    0%   { opacity: 0; transform: translateY(18px) scale(.965); }
    100% { opacity: 1; transform: translateY(0)    scale(1); }
  }
  @keyframes awPanelOut {
    0%   { opacity: 1; transform: translateY(0)    scale(1); }
    100% { opacity: 0; transform: translateY(14px) scale(.975); }
  }
  @keyframes awMsgIn {
    0%   { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes awDot {
    0%, 60%, 100% { transform: translateY(0);   opacity: .35; }
    30%            { transform: translateY(-4px); opacity: 1; }
  }
  @keyframes awSpin { to { transform: rotate(360deg); } }
  @keyframes awPulseRing {
    0%   { transform: scale(1);    opacity: .42; }
    100% { transform: scale(1.95); opacity: 0; }
  }
  @keyframes awGlow {
    0%, 100% { box-shadow: 0 0 0   rgba(${ACCENT_RGB}, 0); }
    50%      { box-shadow: 0 0 28px rgba(${ACCENT_RGB}, .18); }
  }
  @keyframes awFabFloat {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-2px); }
  }
  @keyframes awFabHalo {
    0%, 100% { opacity: .38; transform: scale(1); }
    50%      { opacity: .68; transform: scale(1.06); }
  }
  @keyframes awRotateSlow { to { transform: rotate(360deg); } }
  @keyframes awTooltipIn {
    0%   { opacity: 0; transform: translateY(6px) scale(.97); }
    100% { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes awTooltipOut {
    0%   { opacity: 1; transform: translateY(0)   scale(1); }
    100% { opacity: 0; transform: translateY(4px) scale(.97); }
  }
  .aw-tooltip-in  { animation: awTooltipIn  280ms cubic-bezier(.22,.68,0,1.08) both; }
  .aw-tooltip-out { animation: awTooltipOut 200ms ease both; }

  .aw-panel-in  { animation: awPanelIn  260ms cubic-bezier(.22,.68,0,1.08) both; }
  .aw-panel-out { animation: awPanelOut 220ms ease both; }
  .aw-msg       { animation: awMsgIn    220ms cubic-bezier(.22,.68,0,1.08) both; }

  .aw-scroll::-webkit-scrollbar       { width: 5px; }
  .aw-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px; }
  .aw-scroll::-webkit-scrollbar-thumb:hover { background: rgba(${ACCENT_RGB},.72); }

  .aw-fab, .aw-chip, .aw-ctrl, .aw-send { transition: all 180ms ease; }

  .aw-fab:hover  { transform: translateY(-2px) scale(1.01) !important; }
  .aw-fab:active { transform: translateY(0)    scale(.985) !important; }

  .aw-chip:hover {
    border-color: rgba(${ACCENT_RGB},.30) !important;
    background:   rgba(${ACCENT_RGB},.10) !important;
    color: #fff !important;
  }
  .aw-ctrl:hover {
    background:   rgba(255,255,255,.06) !important;
    color:        rgba(255,255,255,.95) !important;
    border-color: rgba(255,255,255,.14) !important;
  }
  .aw-send:hover:not(:disabled)  { transform: translateY(-1px); box-shadow: 0 10px 30px rgba(${ACCENT_RGB},.34) !important; }
  .aw-send:active:not(:disabled) { transform: translateY(0) scale(.97); }

  .aw-input-wrap { transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease; }
  .aw-input-wrap.focused {
    border-color: rgba(${ACCENT_RGB},.50) !important;
    background:   rgba(255,255,255,.02) !important;
  }

  .aw-text p { margin: 0 0 10px; }
  .aw-text p:last-child { margin-bottom: 0; }
  .aw-text ul { margin: 8px 0 0; padding-left: 18px; }
  .aw-text li { margin: 5px 0; }

  .aw-panel-glow {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(circle at top right,  rgba(${ACCENT_RGB},.10), transparent 30%),
      radial-gradient(circle at bottom left, rgba(${ACCENT_RGB},.06), transparent 26%);
  }
  .aw-backdrop {
    position: fixed; inset: 0; z-index: 9997;
    background: rgba(0,0,0,.18); backdrop-filter: blur(4px);
  }
  .aw-fab-wrapper {
    position: fixed; right: 24px; bottom: 24px; z-index: 9999;
    transition: bottom .4s cubic-bezier(.16,1,.3,1);
    animation: awFabFloat 2.8s ease-in-out infinite;
  }
  .aw-panel-wrapper {
    position: fixed; right: 24px; bottom: 112px;
    width: 388px; max-width: calc(100vw - 20px);
    height: min(620px, calc(100vh - 112px)); z-index: 9998;
    transition: bottom .4s cubic-bezier(.16,1,.3,1);
  }
  @media (max-width: 768px) {
    .aw-fab-wrapper   { right: 16px; bottom: 16px; }
    .aw-panel-wrapper { right: 10px; left: 10px; top: 12px; bottom: 104px; width: auto; max-width: none; height: auto; }
  }
  @media (max-width: 639px) {
    .aw-fab-wrapper   { display: none !important; }
    .aw-panel-wrapper { display: none !important; }
    .aw-backdrop      { display: none !important; }
  }
`;

// ─── Message formatter ────────────────────────────────────────────────────────
function formatMessage(content: string) {
  const lines = content.split('\n').filter(l => l.trim() !== '');
  const elements: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    elements.push(<ul key={key}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };

  lines.forEach((line, idx) => {
    const t = line.trim();
    if (t.startsWith('- ') || t.startsWith('• ')) {
      bullets.push(t.replace(/^(-|•)\s*/, ''));
    } else {
      flush(`b-${idx}`);
      elements.push(<p key={`p-${idx}`}>{line}</p>);
    }
  });
  flush('b-final');
  return <div className="aw-text">{elements}</div>;
}

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Colombo prices',   value: 'What are current house prices in Colombo?' },
  { label: 'Land in Kandy',    value: 'Show me land prices in Kandy' },
  { label: 'Best value areas', value: 'Which districts offer the best value for money right now?' },
  { label: 'Rent vs Buy',      value: 'Is it better to rent or buy property in Sri Lanka right now?' },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function ChatWidget({ onFilters }: { onFilters?: (filters: NonNullable<ChatResponse['filters']>) => void }) {
  const [open,        setOpen]        = useState(false);
  const [animOut,     setAnimOut]     = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [input,       setInput]       = useState('');
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [focused,     setFocused]     = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipOut,  setTooltipOut]  = useState(false);

  const panelRef    = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isInputEmpty = useMemo(() => input.trim().length === 0, [input]);

  // ── Callbacks defined first so effects can reference them ─────────────────
  const dismissTooltip = useCallback(() => {
    setTooltipOut(true);
    setTimeout(() => { setShowTooltip(false); setTooltipOut(false); }, 200);
    try { localStorage.setItem(TOOLTIP_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const closePanel = useCallback(() => {
    setAnimOut(true);
    setTimeout(() => { setOpen(false); setAnimOut(false); setLoading(false); }, 220);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Persist messages on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-24));
      }
    } catch { /* ignore */ }

    // Show tooltip for new users after a short delay
    const seen = localStorage.getItem(TOOLTIP_KEY);
    if (!seen) {
      const t = setTimeout(() => setShowTooltip(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Auto-dismiss tooltip after it appears
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(() => dismissTooltip(), 8000);
    return () => clearTimeout(t);
  }, [showTooltip, dismissTooltip]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24))); }
    catch { /* ignore */ }
  }, [messages, mounted]);

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // Focus textarea when opened
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 180);
    return () => clearTimeout(t);
  }, [open]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) closePanel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open || !panelRef.current) return;
      const fab = document.getElementById('propertylk-ai-fab');
      if (panelRef.current.contains(e.target as Node)) return;
      if (fab?.contains(e.target as Node)) return;
      closePanel();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const toggle = useCallback(() => {
    if (showTooltip) dismissTooltip();
    if (open) closePanel(); else setOpen(true);
  }, [open, closePanel, showTooltip, dismissTooltip]);

  const clearChat = () => {
    setLoading(false);
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const sendPrompt = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed, id: genId() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage(trimmed, history);
      setMessages([...next, { role: 'assistant', content: res.response, id: genId() }]);
      
      if (res.filters && onFilters) {
        onFilters(res.filters);
      }
    } catch {
      setMessages([...next, {
        role: 'assistant',
        content: 'Connection issue. Please try again.',
        id: genId(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(input); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="aw">
      <style>{STYLES}</style>

      {open && <div className="aw-backdrop" />}

      {/* ── Tooltip for new users ── */}
      {showTooltip && !open && (
        <div
          className={tooltipOut ? 'aw-tooltip-out' : 'aw-tooltip-in'}
          style={{
            position: 'fixed', right: 100, bottom: 30, zIndex: 9998,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px 10px 12px',
            background: 'linear-gradient(135deg, rgba(20,20,28,.96), rgba(12,12,18,.98))',
            border: `1px solid rgba(${ACCENT_RGB},.28)`,
            borderRadius: '14px',
            boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(${ACCENT_RGB},.08)`,
            backdropFilter: 'blur(16px)',
            maxWidth: 230,
            cursor: 'default',
          }}
        >
          {/* Arrow pointing right toward FAB */}
          <span style={{
            position: 'absolute', right: -7, top: '50%',
            width: 12, height: 12,
            background: 'linear-gradient(135deg, rgba(12,12,18,.98), rgba(12,12,18,.98))',
            border: `1px solid rgba(${ACCENT_RGB},.28)`,
            borderLeft: 'none', borderBottom: 'none',
            transform: 'translateY(-50%) rotate(45deg)',
          }} />

          <span style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: `rgba(${ACCENT_RGB},.15)`, border: `1px solid rgba(${ACCENT_RGB},.25)`,
            color: ACCENT,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </span>

          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Ask Property AI
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(255,255,255,.5)', lineHeight: 1.4 }}>
              Get live prices for any district
            </p>
          </div>

          <button
            onClick={dismissTooltip}
            style={{
              background: 'none', border: 'none', padding: '2px', cursor: 'pointer',
              color: 'rgba(255,255,255,.3)', flexShrink: 0, display: 'grid', placeItems: 'center',
              borderRadius: 4, lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        id="propertylk-ai-fab"
        onClick={toggle}
        aria-label={open ? 'Close property assistant' : 'Open property assistant'}
        className="aw-fab aw-fab-wrapper"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 48, height: 48, padding: 0,
          background: '#111111',
          color: '#fff', border: '1px solid rgba(255,255,255,.1)', borderRadius: '50%',
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          cursor: 'pointer', position: 'fixed',
        }}
      >
        <span style={{ color: ACCENT }}>
          {open ? <CloseIcon /> : <PropertyIcon />}
        </span>
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Property AI assistant"
          aria-modal="true"
          className={`aw-panel-wrapper ${animOut ? 'aw-panel-out' : 'aw-panel-in'}`}
          style={{
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: '20px',
            background: '#111111',
            border: '1px solid rgba(255,255,255,.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,.6)',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            position: 'relative', padding: '13px 13px 12px',
            borderBottom: '1px solid rgba(255,255,255,.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'transparent',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015))',
                border: '1px solid rgba(255,255,255,.06)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
                color: ACCENT,
              }}>
                <PropertyIcon />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
                  Property AI
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#3ddc84',
                    boxShadow: '0 0 8px rgba(61,220,132,.6)', flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,.42)',
                    letterSpacing: '0.13em', textTransform: 'uppercase',
                  }}>
                    Online · Sri Lanka Property Expert
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={clearChat} className="aw-ctrl" style={{
                height: '31px', padding: '0 10px', borderRadius: '9px',
                border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)',
                color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}>Clear</button>
              <button onClick={closePanel} aria-label="Close" className="aw-ctrl" style={{
                width: '31px', height: '31px', borderRadius: '9px',
                border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)',
                color: 'rgba(255,255,255,.55)', cursor: 'pointer', display: 'grid', placeItems: 'center',
              }}><CloseIcon /></button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="aw-scroll" style={{
            position: 'relative', flex: 1, overflowY: 'auto',
            padding: '18px 16px 12px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 1,
          }}>
            {messages.length === 0 && (
              <>
                {/* Welcome card */}
                <div className="aw-msg" style={{
                  padding: '18px', borderRadius: '16px',
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.07)',
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
                    Talk to <span style={{ color: ACCENT }}>Property AI</span>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,.79)' }}>
                    Ask about prices, areas, trends, or anything Sri Lanka real estate — I'll pull live data from the database.
                  </p>
                  <div style={{
                    marginTop: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#3ddc84',
                      boxShadow: '0 0 10px rgba(61,220,132,.55)',
                    }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: '0.09em' }}>
                      Live data · Updated daily
                    </span>
                  </div>
                </div>

                {/* Quick action chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => sendPrompt(a.value)} className="aw-chip" style={{
                      padding: '9px 13px', borderRadius: 999,
                      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
                      color: 'rgba(255,255,255,.64)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Message bubbles */}
            {messages.map(msg => (
              <div key={msg.id} className="aw-msg" style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 4,
              }}>
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                  color: msg.role === 'user' ? `rgba(${ACCENT_RGB},.72)` : 'rgba(255,255,255,.28)',
                }}>
                  {msg.role === 'user' ? 'You' : 'Property AI'}
                </span>
                <div style={{
                  maxWidth: '88%', padding: '13px 15px', fontSize: '13.5px',
                  lineHeight: 1.68, color: 'rgba(255,255,255,.92)',
                  borderRadius: msg.role === 'user' ? '18px 18px 7px 18px' : '7px 18px 18px 18px',
                  ...(msg.role === 'user' ? {
                    background: `rgba(${ACCENT_RGB},.12)`,
                    border: `1px solid rgba(${ACCENT_RGB},.2)`,
                  } : {
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid rgba(255,255,255,.07)',
                  }),
                }}>
                  {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div className="aw-msg" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)' }}>
                  Property AI
                </span>
                <div style={{
                  padding: '14px 16px', borderRadius: '7px 18px 18px 18px',
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.07)',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {([0, 0.18, 0.36] as number[]).map((delay, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: ACCENT,
                      animation: `awDot 1.3s ${delay}s infinite`, display: 'block',
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input ── */}
          <div style={{ padding: '12px 14px 14px', background: 'transparent', borderTop: '1px solid rgba(255,255,255,.07)', zIndex: 1 }}>
            <div
              className={`aw-input-wrap ${focused ? 'focused' : ''}`}
              style={{
                display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px',
                borderRadius: '16px', background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,.08)',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Ask about properties in Sri Lanka…"
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  resize: 'none', fontSize: '13.5px', lineHeight: 1.5, color: '#fff',
                  padding: '8px 6px 8px 8px', maxHeight: '120px', overflowY: 'auto',
                }}
              />
              <button
                onClick={() => sendPrompt(input)}
                disabled={isInputEmpty || loading}
                className="aw-send"
                style={{
                  width: 42, height: 42, borderRadius: '14px', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  cursor: isInputEmpty || loading ? 'default' : 'pointer',
                  border: 'none',
                  ...(isInputEmpty || loading ? {
                    background: 'rgba(255,255,255,.05)',
                    color: 'rgba(255,255,255,.22)',
                  } : {
                    background: ACCENT, color: '#fff',
                    boxShadow: `0 8px 24px rgba(${ACCENT_RGB},.28)`,
                  }),
                }}
              >
                {loading ? <Spinner /> : <SendIcon />}
              </button>
            </div>
            <p style={{
              textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)',
              margin: '8px 0 0', letterSpacing: '.04em',
            }}>
              Powered by live property data · AI may make mistakes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
