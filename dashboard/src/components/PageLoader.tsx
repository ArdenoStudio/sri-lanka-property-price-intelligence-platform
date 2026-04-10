import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export const PageLoader: React.FC<{ onComplete?: () => void; minDuration?: number }> = ({
  onComplete,
  minDuration = 1800,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  const rafRef = useRef(0);
  const lastRef = useRef(0);

  // Skip animation for users who prefer reduced motion
  useEffect(() => {
    if (!prefersReducedMotion) return;
    setDone(true);
    onComplete?.();
  }, [prefersReducedMotion, onComplete]);

  // Progress counter via RAF
  useEffect(() => {
    if (prefersReducedMotion) return;
    const start = Date.now();
    const duration = minDuration * 0.85;

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
  }, [minDuration, prefersReducedMotion]);

  // Exit sequence
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    t(() => setExiting(true), minDuration);
    t(() => { setDone(true); onComplete?.(); }, minDuration + 350);

    return () => timers.forEach(clearTimeout);
  }, [minDuration, onComplete, prefersReducedMotion]);

  if (done) return null;

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

      {/* Wordmark */}
      <p
        style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '22px',
          fontWeight: 500,
          color: '#f5f5f5',
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        PropertyLK
      </p>

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
      <p
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
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
  );
};
