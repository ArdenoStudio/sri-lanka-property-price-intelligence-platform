import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatResponse } from '../api';
import { sendChatMessage } from '../api';

const ACCENT = '#14b8a6';
const ACCENT_RGB = '20,184,166';
const STORAGE_KEY = 'propertylk_chat_v1';
const genId = () => Math.random().toString(36).slice(2, 10);

type Message = { role: 'user' | 'assistant'; content: string; id: string };
type PromptChip = { label: string; caption: string; value: string };

const PROMPT_CHIPS: PromptChip[] = [
  {
    label: '3-bed value',
    caption: 'Which districts offer the best value for 3-bedroom houses right now?',
    value: 'Which districts offer the best value for 3-bedroom houses right now?',
  },
  {
    label: 'Apartment yields',
    caption: 'Where are 2-bedroom apartments showing the strongest rental yields?',
    value: 'Where are 2-bedroom apartments showing the strongest rental yields?',
  },
  {
    label: 'Colombo comps',
    caption: 'Show comparable sale listings for a 2-bedroom apartment in Colombo 5.',
    value: 'Show comparable sale listings for a 2-bedroom apartment in Colombo 5.',
  },
  {
    label: 'Kandy land trend',
    caption: 'How are land prices trending in Kandy, and what plot sizes are moving?',
    value: 'How are land prices trending in Kandy, and what plot sizes are moving?',
  },
];

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 3L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 3L14 21L10 14L3 10L21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PropertyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const Spinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ animation: 'awSpin .85s linear infinite', display: 'block' }}
  >
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.18)" strokeWidth="2.2" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const STYLES = `
  .aw {
    --aw-bg: rgba(12,12,14,.96);
    --aw-bg-soft: rgba(255,255,255,.03);
    --aw-bg-softer: rgba(255,255,255,.02);
    --aw-border: rgba(255,255,255,.08);
    --aw-border-strong: rgba(255,255,255,.12);
    --aw-text: rgba(255,255,255,.96);
    --aw-text-soft: rgba(255,255,255,.72);
    --aw-text-muted: rgba(255,255,255,.45);
    --aw-header-font: "Cal Sans", "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --aw-body-font: "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-family: var(--aw-body-font);
  }

  .aw * { box-sizing: border-box; }
  .aw button, .aw textarea { font-family: inherit; }
  .aw button { -webkit-tap-highlight-color: transparent; }

  @keyframes awPanelIn {
    0% { opacity: 0; transform: translateY(14px) scale(.985); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes awPanelOut {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(10px) scale(.99); }
  }

  @keyframes awMsgIn {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes awDot {
    0%, 60%, 100% { transform: translateY(0); opacity: .35; }
    30% { transform: translateY(-3px); opacity: 1; }
  }

  @keyframes awSpin { to { transform: rotate(360deg); } }

  .aw-panel-in { animation: awPanelIn 220ms cubic-bezier(.22,1,.36,1) both; }
  .aw-panel-out { animation: awPanelOut 180ms ease both; }
  .aw-msg { animation: awMsgIn 220ms cubic-bezier(.22,1,.36,1) both; }

  .aw-launcher,
  .aw-chip,
  .aw-ctrl,
  .aw-send,
  .aw-input-wrap {
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .aw-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9997;
    background: rgba(0,0,0,.12);
    backdrop-filter: blur(2px);
  }

  .aw-launcher-wrapper,
  .aw-panel-wrapper {
    position: fixed;
    right: 24px;
    z-index: 9998;
  }

  .aw-launcher-wrapper { bottom: 24px; width: min(304px, calc(100vw - 32px)); }
  .aw-panel-wrapper {
    bottom: 96px;
    width: min(376px, calc(100vw - 32px));
    height: min(560px, calc(100vh - 128px));
  }

  .aw-launcher {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border-radius: 18px;
    border: 1px solid var(--aw-border);
    background: var(--aw-bg);
    color: var(--aw-text);
    box-shadow: 0 10px 30px rgba(0,0,0,.32);
    cursor: pointer;
  }

  .aw-launcher:hover {
    transform: translateY(-1px);
    border-color: var(--aw-border-strong);
    background: rgba(16,16,18,.98);
  }

  .aw-launcher-copy { min-width: 0; text-align: left; }
  .aw-launcher-title {
    margin: 0;
    font-family: var(--aw-header-font);
    font-size: 16px;
    line-height: 1;
    color: var(--aw-text);
    letter-spacing: -0.02em;
  }

  .aw-launcher-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--aw-text-muted);
  }

  .aw-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: 22px;
    border: 1px solid var(--aw-border);
    background: var(--aw-bg);
    box-shadow: 0 20px 54px rgba(0,0,0,.48);
  }

  .aw-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }

  .aw-header-copy p,
  .aw-header-copy h2 { margin: 0; }

  .aw-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    font-weight: 600;
    color: rgba(${ACCENT_RGB}, .86);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .aw-eyebrow::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: ${ACCENT};
    box-shadow: 0 0 0 4px rgba(${ACCENT_RGB}, .12);
  }

  .aw-heading {
    margin-top: 10px !important;
    font-family: var(--aw-header-font);
    font-size: 22px;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--aw-text);
  }

  .aw-subheading {
    margin-top: 8px !important;
    font-size: 13px;
    line-height: 1.5;
    color: var(--aw-text-muted);
    max-width: 28ch;
  }

  .aw-ctrl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 34px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px solid var(--aw-border);
    background: var(--aw-bg-softer);
    color: var(--aw-text-soft);
    cursor: pointer;
  }

  .aw-ctrl:hover {
    border-color: var(--aw-border-strong);
    background: var(--aw-bg-soft);
    color: var(--aw-text);
  }

  .aw-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .aw-scroll::-webkit-scrollbar { width: 6px; }
  .aw-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-scroll::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,.12);
    border-radius: 999px;
  }

  .aw-intro {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.06);
    background: rgba(255,255,255,.025);
  }

  .aw-intro-title {
    margin: 0;
    font-family: var(--aw-header-font);
    font-size: 18px;
    line-height: 1.1;
    letter-spacing: -0.025em;
    color: var(--aw-text);
  }

  .aw-intro-copy {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--aw-text-soft);
  }

  .aw-chip-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .aw-chip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid var(--aw-border);
    background: rgba(255,255,255,.02);
    color: var(--aw-text);
    text-align: left;
    cursor: pointer;
  }

  .aw-chip:hover {
    transform: translateY(-1px);
    border-color: rgba(${ACCENT_RGB}, .28);
    background: rgba(${ACCENT_RGB}, .08);
  }

  .aw-chip-label {
    font-family: var(--aw-header-font);
    font-size: 14px;
    line-height: 1;
    color: var(--aw-text);
    letter-spacing: -0.02em;
  }

  .aw-chip-copy {
    font-size: 12px;
    line-height: 1.45;
    color: var(--aw-text-muted);
  }

  .aw-message-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .aw-message-group.user { align-items: flex-end; }
  .aw-message-group.assistant { align-items: flex-start; }

  .aw-message-label {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--aw-text-muted);
  }

  .aw-message-label.user { color: rgba(${ACCENT_RGB}, .92); }

  .aw-bubble {
    max-width: 88%;
    padding: 12px 14px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.65;
    color: var(--aw-text);
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.07);
  }

  .aw-bubble.user {
    background: rgba(${ACCENT_RGB}, .12);
    border-color: rgba(${ACCENT_RGB}, .18);
  }

  .aw-text { font-family: var(--aw-body-font); }
  .aw-text p { margin: 0 0 10px; }
  .aw-text p:last-child { margin-bottom: 0; }
  .aw-text ul { margin: 8px 0 0; padding-left: 18px; }
  .aw-text li { margin: 5px 0; }

  .aw-loading {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.07);
    background: rgba(255,255,255,.03);
  }

  .aw-loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: ${ACCENT};
    display: block;
  }

  .aw-footer {
    border-top: 1px solid rgba(255,255,255,.06);
    padding: 14px 18px 18px;
  }

  .aw-hint {
    margin: 0 0 10px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--aw-text-muted);
  }

  .aw-input-wrap {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px;
    border-radius: 18px;
    border: 1px solid var(--aw-border);
    background: rgba(0,0,0,.24);
  }

  .aw-input-wrap.focused {
    border-color: rgba(${ACCENT_RGB}, .34);
    box-shadow: 0 0 0 1px rgba(${ACCENT_RGB}, .08);
  }

  .aw-textarea {
    flex: 1;
    resize: none;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--aw-text);
    font-size: 13px;
    line-height: 1.55;
    padding: 8px 8px 8px 10px;
    max-height: 120px;
    overflow-y: auto;
  }

  .aw-textarea::placeholder { color: rgba(255,255,255,.36); }

  .aw-send {
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 14px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: white;
  }

  .aw-send:disabled {
    cursor: default;
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.22);
  }

  .aw-send:not(:disabled) {
    cursor: pointer;
    background: ${ACCENT};
    box-shadow: 0 8px 22px rgba(${ACCENT_RGB}, .22);
  }

  .aw-send:not(:disabled):hover { transform: translateY(-1px); }

  .aw-meta {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .aw-disclaimer {
    margin: 0;
    font-size: 10px;
    line-height: 1.4;
    color: rgba(255,255,255,.28);
  }

  .aw-reset {
    border: 0;
    background: transparent;
    color: rgba(255,255,255,.46);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }

  .aw-reset:hover { color: var(--aw-text); }

  @media (max-width: 768px) {
    .aw-launcher-wrapper,
    .aw-panel-wrapper {
      right: 12px;
      left: 12px;
      width: auto;
    }

    .aw-launcher-wrapper { bottom: 12px; }
    .aw-panel-wrapper {
      top: 12px;
      bottom: 84px;
      height: auto;
    }
  }

  @media (max-width: 560px) {
    .aw-chip-grid { grid-template-columns: 1fr; }
    .aw-bubble { max-width: 92%; }
  }
`;

function formatMessage(content: string) {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const elements: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    elements.push(<ul key={key}>{bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>);
    bullets = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      bullets.push(trimmed.replace(/^(-|•)\s*/, ''));
      return;
    }

    flush(`b-${index}`);
    elements.push(<p key={`p-${index}`}>{line}</p>);
  });

  flush('b-final');
  return <div className="aw-text">{elements}</div>;
}

export function ChatWidget({ onFilters }: { onFilters?: (filters: NonNullable<ChatResponse['filters']>) => void }) {
  const [open, setOpen] = useState(false);
  const [animOut, setAnimOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isInputEmpty = useMemo(() => input.trim().length === 0, [input]);
  const launcherSubtitle = messages.length
    ? `Resume ${messages.length} saved message${messages.length === 1 ? '' : 's'}`
    : 'Ask about beds, comps, yields, and district pricing';

  const closePanel = useCallback(() => {
    setAnimOut(true);
    window.setTimeout(() => {
      setOpen(false);
      setAnimOut(false);
      setLoading(false);
    }, 180);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setMessages(parsed.slice(-24));
      }
    } catch {
      // Ignore invalid local storage payloads.
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
    } catch {
      // Ignore local storage write failures.
    }
  }, [messages, mounted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 140);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        closePanel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closePanel]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!open || !panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      closePanel();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, closePanel]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const clearChat = useCallback(() => {
    setLoading(false);
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore local storage write failures.
    }
  }, []);

  const sendPrompt = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed, id: genId() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(message => ({ role: message.role, content: message.content }));
      const response = await sendChatMessage(trimmed, history);

      setMessages([
        ...nextMessages,
        { role: 'assistant', content: response.response, id: genId() },
      ]);

      if (response.filters && onFilters) {
        onFilters(response.filters);
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: 'Connection issue. Please try again.',
          id: genId(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, onFilters]);

  const onComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(input);
    }
  };

  return (
    <div className="aw">
      <style>{STYLES}</style>

      {open && <div className="aw-backdrop" />}

      {!open && (
        <div className="aw-launcher-wrapper">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open property Q&A"
            className="aw-launcher"
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.03)',
                color: ACCENT,
                flexShrink: 0,
              }}
            >
              <PropertyIcon />
            </span>

            <span className="aw-launcher-copy">
              <p className="aw-launcher-title">Property Q&amp;A</p>
              <p className="aw-launcher-subtitle">{launcherSubtitle}</p>
            </span>

            <span
              aria-hidden="true"
              style={{
                width: 30,
                height: 30,
                borderRadius: 11,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.06)',
                color: 'rgba(255,255,255,.68)',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              +
            </span>
          </button>
        </div>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Property Q&A assistant"
          aria-modal="true"
          className={`aw-panel-wrapper ${animOut ? 'aw-panel-out' : 'aw-panel-in'}`}
        >
          <div className="aw-panel">
            <div className="aw-header">
              <div className="aw-header-copy">
                <p className="aw-eyebrow">property.lk Q&amp;A</p>
                <h2 className="aw-heading">Ask with context</h2>
                <p className="aw-subheading">
                  Quieter, data-led answers for districts, bedrooms, comparable listings, and yield checks.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {messages.length > 0 && (
                  <button type="button" onClick={clearChat} className="aw-ctrl">
                    Reset
                  </button>
                )}
                <button type="button" onClick={closePanel} aria-label="Close property Q&A" className="aw-ctrl">
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="aw-scroll">
              {messages.length === 0 && (
                <>
                  <div className="aw-intro aw-msg">
                    <p className="aw-intro-title">Start with a sharp question.</p>
                    <p className="aw-intro-copy">
                      property.lk is strongest when you include district, property type, and bedrooms. These prompts lean on
                      richer API data instead of generic chat filler.
                    </p>
                  </div>

                  <div className="aw-chip-grid">
                    {PROMPT_CHIPS.map(chip => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => void sendPrompt(chip.value)}
                        className="aw-chip aw-msg"
                      >
                        <span className="aw-chip-label">{chip.label}</span>
                        <span className="aw-chip-copy">{chip.caption}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map(message => (
                <div key={message.id} className={`aw-message-group aw-msg ${message.role}`}>
                  <span className={`aw-message-label ${message.role}`}>
                    {message.role === 'user' ? 'You' : 'property.lk AI'}
                  </span>
                  <div className={`aw-bubble ${message.role}`}>
                    {message.role === 'assistant' ? formatMessage(message.content) : message.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="aw-message-group aw-msg assistant">
                  <span className="aw-message-label">property.lk AI</span>
                  <div className="aw-loading">
                    {[0, 0.18, 0.36].map((delay, index) => (
                      <span
                        key={index}
                        className="aw-loading-dot"
                        style={{ animation: `awDot 1.3s ${delay}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="aw-footer">
              <p className="aw-hint">Best results: district + property type + bedrooms.</p>

              <div className={`aw-input-wrap ${focused ? 'focused' : ''}`}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Ask about pricing, comps, or yield..."
                  rows={1}
                  className="aw-textarea"
                />

                <button
                  type="button"
                  onClick={() => void sendPrompt(input)}
                  disabled={isInputEmpty || loading}
                  className="aw-send"
                  aria-label="Send message"
                >
                  {loading ? <Spinner /> : <SendIcon />}
                </button>
              </div>

              <div className="aw-meta">
                <p className="aw-disclaimer">Live property data helps, but AI can still make mistakes.</p>
                {messages.length > 0 && (
                  <button type="button" onClick={clearChat} className="aw-reset">
                    Clear chat
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
