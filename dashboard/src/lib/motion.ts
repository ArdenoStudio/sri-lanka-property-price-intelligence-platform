import type { Transition } from 'framer-motion';

/** property.lk B&W — 3 motions, ease-out only. Never type:'spring' / bounce. Pass `reduce` from useReducedMotion(). */
export const ease = [0.22, 1, 0.36, 1] as const;
export const tx = (d: number, reduce?: boolean | null): Transition =>
  reduce ? { duration: 0 } : { duration: d, ease };

/** 1) Entrance — section / hero, once */
export const enter = (r?: boolean | null) =>
  ({ initial: r ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: tx(0.36, r) });

/** 2) Feedback — label swaps, pills, layoutId */
export const feedback = (r?: boolean | null) =>
  ({ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: tx(0.14, r) });

/** 3) Surface — page, modal, tray */
export const surface = (r?: boolean | null) =>
  ({ initial: r ? false : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: tx(0.22, r) });
