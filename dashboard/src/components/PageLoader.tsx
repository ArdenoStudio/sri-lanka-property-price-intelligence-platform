import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const SESSION_KEY = 'propertylk_loader_shown';

export const PageLoader: React.FC<{ onComplete?: () => void; minDuration?: number }> = ({
  onComplete,
  minDuration = 1800,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Check if loader has already run this session
  const hasShownThisSession = typeof window !== 'undefined' &&
    sessionStorage.getItem(SESSION_KEY) === '1';

  // For repeat visits: use a much shorter duration (fast fade-in only)
  const effectiveDuration = hasShownThisSession ? 400 : minDuration;
  const isRepeatVisit = hasShownThisSession;

  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(isRepeatVisit ? 100 : 0);
  const [exiting, setExiting] = useState(false);

  const rafRef = useRef(0);
  const lastRef = useRef(0);

  // Skip animation for users who prefer reduced motion
  useEffect(() => {
    if (!prefersReducedMotion) return;
    setDone(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
    onComplete?.();
  }, [prefersReducedMotion, onComplete]);

  // Progress counter via RAF — skip expensive animation for repeat visits
  useEffect(() => {
    if (prefersReducedMotion || isRepeatVisit) return;
    const start = Date.now();
    const duration = effectiveDuration * 0.85;

    const tick = () => {
      const raw = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      const rounded = Math.round(eased * 100);
      if (rounded !== lastRef.current) {
        lastRef.current = rounded;
        setProgress(rounded);
      }
      if (raw < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [effectiveDuration, prefersReducedMotion, isRepeatVisit]);

  // Exit sequence
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    t(() => setExiting(true), effectiveDuration);
    t(() => {
      setDone(true);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
      onComplete?.();
    }, effectiveDuration + 350);

    return () => timers.forEach(clearTimeout);
  }, [effectiveDuration, onComplete, prefersReducedMotion]);

  if (done) return null;

  // Repeat visits: minimal fast fade loader (no progress bar, no branding animation)
  if (isRepeatVisit) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: '#000000',
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: exiting ? 'none' : 'all',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="noise-overlay" aria-hidden="true" />
        <p
          style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '20px',
            fontWeight: 600,
            color: '#f5f5f5',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          PropertyLK
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#000000',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: exiting ? 'none' : 'all',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px',
      }}
    >
      {/* Noise grain */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* Logo and Wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <motion.img 
          src="/favicon.svg" 
          alt="PropertyLK Logo" 
          style={{ width: '56px', height: '56px' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <p
          style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#f5f5f5',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          PropertyLK
        </p>
      </div>

      {/* Progress line */}
      <div
        style={{
          width: '200px',
          height: '1px',
          background: 'rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#14b8a6',
            transformOrigin: 'left',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress / 100 }}
          transition={{ ease: 'easeOut', duration: 0.08 }}
        />
      </div>

      {/* Bottom label */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <img 
          src="/ardeno-logo.svg" 
          alt="Ardeno Logo" 
          style={{ height: '40px' }}
        />
        <p
          style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '10px',
            color: '#2e2e2e',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
        >
          Sri Lanka Property Intelligence
        </p>
      </div>
    </div>
  );
};
