import { useRef, useEffect } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip on touch/coarse pointer devices
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    if (!dotRef.current || !ringRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dot = dotRef.current!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ring = ringRef.current!;

    document.body.classList.add('cursor-custom-active');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = 0;
    const LERP = 0.13;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function tick() {
      ringX = lerp(ringX, mouseX, LERP);
      ringY = lerp(ringY, mouseY, LERP);

      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;

      rafId = requestAnimationFrame(tick);
    }

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }

    const INTERACTIVE = 'a, button, [role="button"], label, select, input, textarea, [tabindex="0"]';

    function onMouseOver(e: MouseEvent) {
      const target = e.target as Element;
      if (target.closest && target.closest(INTERACTIVE)) {
        ring.classList.add('is-hovering');
      }
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as Element;
      if (target.closest && target.closest(INTERACTIVE)) {
        const related = e.relatedTarget as Element | null;
        if (!related || !related.closest || !related.closest(INTERACTIVE)) {
          ring.classList.remove('is-hovering');
        }
      }
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseover', onMouseOver, { passive: true });
    document.addEventListener('mouseout', onMouseOut, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove('cursor-custom-active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
