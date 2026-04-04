import React, { useEffect, useRef, useState, memo } from "react";
import { motion } from "framer-motion";

// --- Font loader ---
if (typeof document !== "undefined" && !document.getElementById("avl-fonts")) {
  const link = document.createElement("link");
  link.id = "avl-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Cinzel:wght@600&family=Sora:wght@300&family=Fraunces:ital,wght@1,400;1,500&display=swap";
  document.head.appendChild(link);
}

// --- Keyframes ---
const STYLES = `
  @keyframes avl-breathe {
    0%,100% { opacity:0.3; transform:scale(1); filter: blur(20px); }
    50%      { opacity:0.6;  transform:scale(1.15); filter: blur(30px); }
  }
  @keyframes avl-drawPath {
    from { stroke-dashoffset: 2000; filter: drop-shadow(0 0 2px rgba(99,102,241,0)); }
    to   { stroke-dashoffset: 0; filter: drop-shadow(0 0 12px rgba(99,102,241,0.6)); }
  }
  @keyframes avl-fillFade {
    from { opacity: 0; filter: blur(4px); transform: scale(0.95); }
    to   { opacity: 1; filter: blur(0px); transform: scale(1); }
  }
  @keyframes avl-charIn {
    from { opacity:0; transform: translateY(20px) scale(1.15); filter:blur(12px) brightness(2); letter-spacing: 0.05em; }
    to   { opacity:1; transform: translateY(0) scale(1); filter:blur(0) brightness(1);  letter-spacing: 0.18em; }
  }
  @keyframes avl-charInUp {
    from { opacity:0; transform: translateY(15px) scale(0.9); filter:blur(8px); }
    to   { opacity:1; transform: translateY(0) scale(1); filter:blur(0); }
  }
  @keyframes avl-flashBlue {
    0%   { opacity:0; }
    40%  { opacity:1; filter: blur(10px); }
    100% { opacity:0; filter: blur(0px); }
  }
  @keyframes avl-fadeOutPhase {
    from { transform:scale(1); filter: blur(0px); }
    to   { transform:scale(1.05); filter: blur(14px); }
  }
  @keyframes avl-fadeInPhase {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes avl-crownReveal {
    from { opacity:0; transform:translateY(-20px) scale(0.9); filter: blur(10px); }
    to   { opacity:1; transform:translateY(0) scale(1); filter: blur(0px); }
  }
  @keyframes avl-phaseIn {
    from { opacity:0; transform:translateY(6px); filter: blur(4px); }
    to   { opacity:1; transform:translateY(0); filter: blur(0); }
  }
  @keyframes avl-phasePop {
    from { opacity:0; transform:translateY(10px) scale(0.96); letter-spacing: 0.12em; text-shadow: 0 0 0 rgba(129,140,248,0); }
    60%  { opacity:1; transform:translateY(0) scale(1); letter-spacing: 0.34em; text-shadow: 0 0 18px rgba(129,140,248,0.35); }
    to   { opacity:1; transform:translateY(0) scale(1); letter-spacing: 0.28em; text-shadow: 0 0 8px rgba(129,140,248,0.25); }
  }
  @keyframes avl-phaseGlow {
    from { text-shadow: 0 0 0 rgba(129,140,248,0); }
    to   { text-shadow: 0 0 24px rgba(129,140,248,0.35); }
  }
  .glass-overlay {
    backdrop-filter: blur(8px);
    background: radial-gradient(circle at 50% 50%, rgba(10,5,5,0.4) 0%, rgba(0,0,0,0.9) 100%);
  }
`;

const FULL_COVER: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

const A_MARK_PATH =
  "M 514.300781 878.699219 L 434.792969 718.777344 " +
  "C 411.382812 739.714844 390.78125 776.453125 391.929688 806.554688 " +
  "L 415.984375 853.996094 " +
  "C 416.851562 855.699219 418.324219 857.015625 420.113281 857.679688 " +
  "L 504.851562 889.203125 " +
  "C 511.304688 891.605469 517.367188 884.867188 514.300781 878.699219 Z " +
  "M 371.617188 791.304688 " +
  "C 371.410156 791.605469 371.222656 791.925781 371.054688 792.265625 " +
  "L 340.871094 853.445312 " +
  "C 340.011719 855.183594 338.523438 856.527344 336.707031 857.207031 " +
  "L 250.40625 889.308594 " +
  "C 243.988281 891.699219 237.9375 885.042969 240.917969 878.878906 " +
  "L 369.019531 614.007812 " +
  "C 371.769531 608.324219 379.851562 608.277344 382.664062 613.929688 " +
  "L 432.074219 713.316406 " +
  "C 404.980469 732.679688 383.765625 759.746094 371.617188 791.304688";

const GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' " +
  "numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const StaggerWord = memo<{ text: string; baseDelay: number; charStyle: React.CSSProperties; animName?: string }>(
  ({ text, baseDelay, charStyle, animName = "avl-charIn" }) => (
    <span style={{ display: "inline-block", overflow: "hidden" }}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            ...charStyle,
            display: "inline-block",
            opacity: 0,
            animation: `${animName} 1.2s cubic-bezier(0.16,1,0.3,1) ${baseDelay + i * 0.08}s forwards`,
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  )
);

const SvgDefs = memo(() => (
  <defs>
    <linearGradient id="avl-aGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#818cf8" />
      <stop offset="50%" stopColor="#6366f1" />
      <stop offset="100%" stopColor="#4f46e5" />
    </linearGradient>
    <linearGradient id="avl-aStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#a5b4fc" />
      <stop offset="100%" stopColor="#6366f1" />
    </linearGradient>
    <filter id="avl-aGlow">
      <feGaussianBlur stdDeviation="8" result="g" />
      <feMerge>
        <feMergeNode in="g" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
));

const ArdenoPhase = memo<{ exiting: boolean; flashRed: boolean; progress: number }>(
  ({ exiting, flashRed, progress }) => (
    <div
      className="glass-overlay"
      style={{
        ...FULL_COVER,
        animation: exiting
          ? "avl-fadeOutPhase 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards"
          : "avl-fadeInPhase 1s ease-out forwards",
        zIndex: 3,
        perspective: "1000px"
      }}
    >
      <div style={{ ...FULL_COVER, backgroundImage: GRAIN_BG, opacity: 0.04, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <div style={{ ...FULL_COVER, background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none" }} />

      {/* Ambient center glow */}
      <div
        style={{
          ...FULL_COVER,
          background: "radial-gradient(circle at 50% 45%, rgba(99,102,241,0.15) 0%, transparent 50%)",
          animation: "avl-breathe 5s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div style={{ ...FULL_COVER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>

          {/* Logo */}
          <div style={{
            width: 80, height: 80, marginBottom: 8,
            opacity: 0,
            animation: "avl-crownReveal 1.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards",
          }}>
            <svg viewBox="200 580 360 340" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <SvgDefs />
              <path d={A_MARK_PATH} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <path
                d={A_MARK_PATH}
                fill="none"
                stroke="url(#avl-aStroke)"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ strokeDasharray: 2000, animation: "avl-drawPath 2.2s cubic-bezier(0.2,1,0.4,1) 0.4s forwards" }}
              />
              <path
                d={A_MARK_PATH}
                fill="url(#avl-aGrad)"
                filter="url(#avl-aGlow)"
                style={{ opacity: 0, transformOrigin: "center", animation: "avl-fillFade 1.4s cubic-bezier(0.16,1,0.3,1) 1.8s forwards" }}
              />
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <StaggerWord
              text="ARDENO"
              baseDelay={0.8}
              charStyle={{
                fontFamily: "'Cinzel', serif",
                fontSize: "32px",
                fontWeight: 600,
                color: "#ffffff",
                textShadow: "0 0 16px rgba(255,255,255,0.3)"
              }}
            />
            <StaggerWord
              text="STUDIO"
              baseDelay={1.4}
              charStyle={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "14px",
                fontWeight: 300,
                fontStyle: "italic",
                color: "rgba(99,102,241,0.8)",
                letterSpacing: "0.5em",
                textShadow: "0 0 12px rgba(99,102,241,0.4)"
              }}
              animName="avl-charInUp"
            />
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", width: 320, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <p style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 10,
          letterSpacing: "0.3em",
          color: "rgba(255,255,255,0.45)",
          transition: "opacity 0.3s ease",
        }}>
          {progress < 100 ? "LOADING" : "INITIALIZING"}
        </p>
        {progress >= 100 && (
          <p style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 10,
            color: "rgba(129,140,248,0.75)",
            animation: "avl-phasePop 0.75s cubic-bezier(0.16,1,0.3,1) forwards, avl-phaseGlow 1.2s ease-out 0.2s forwards",
          }}>
            CONNECTING TO MARKET DATA
          </p>
        )}
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.08)", overflow: "hidden", position: "relative" }}>
          <motion.div
            style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, transparent, #6366f1)", transformOrigin: "left" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ ease: "easeOut", duration: 0.1 }}
          />
        </div>
      </div>

      {flashRed && (
        <div
          style={{
            ...FULL_COVER,
            background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.18) 0%, transparent 80%)",
            animation: "avl-flashBlue 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
);

export const PageLoader: React.FC<{ onComplete?: () => void; minDuration?: number }> = ({
  onComplete,
  minDuration = 2000,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [flashRed, setFlashRed] = useState(false);

  const rafRef = useRef(0);
  const lastProgressRef = useRef(0);

  // Skip animation entirely for users who prefer reduced motion
  useEffect(() => {
    if (!prefersReducedMotion) return;
    setDone(true);
    onComplete?.();
  }, [prefersReducedMotion, onComplete]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (document.getElementById("avl-keyframes")) return;
    const style = document.createElement("style");
    style.id = "avl-keyframes";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const start = Date.now();
    const duration = minDuration * 0.85;
    const tick = () => {
      const rawPhase = Math.min(((Date.now() - start) / duration), 1);
      const easedPhase = 1 - Math.pow(1 - rawPhase, 3);
      const rounded = Math.round(easedPhase * 100);

      if (rounded !== lastProgressRef.current) {
        lastProgressRef.current = rounded;
        setProgress(rounded);
      }
      if (rawPhase < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [minDuration, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    t(() => setFlashRed(true), minDuration);
    t(() => setExiting(true), minDuration + 50);
    t(() => {
      setDone(true);
      onComplete?.();
    }, minDuration + 450);

    return () => timers.forEach(clearTimeout);
  }, [minDuration, onComplete, prefersReducedMotion]);

  if (done) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999999, overflow: "hidden", background: "#050303",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: exiting ? "none" : "all"
      }}
    >
      <ArdenoPhase exiting={exiting} flashRed={flashRed} progress={progress} />
    </div>
  );
};
