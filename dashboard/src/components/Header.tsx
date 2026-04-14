import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';

const GITHUB_REPO = 'ArdenoStudio/sri-lanka-property-price-intelligence-platform';
const GITHUB_URL  = `https://github.com/${GITHUB_REPO}`;

export function Header() {
  const [tooltip, setTooltip] = useState(false);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then(r => r.json())
      .then(d => { if (typeof d.stargazers_count === 'number') setStars(d.stargazers_count); })
      .catch(() => {});
  }, []);

  const { scrollY } = useScroll();
  const raw = useTransform(scrollY, [0, 80], [0, 1], { clamp: true });
  const p   = useSpring(raw, { stiffness: 160, damping: 26, mass: 0.7 });

  const borderRadius = useTransform(p, [0, 1], [16, 9999]);
  const paddingX     = useTransform(p, [0, 1], [24, 20]);
  const paddingY     = useTransform(p, [0, 1], [14, 10]);
  const logoSize     = useTransform(p, [0, 1], [28, 24]);

  const taglineOpacity = useTransform(p, [0, 0.38], [1, 0],   { clamp: true });
  const taglineWidth   = useTransform(p, [0, 0.72], [132, 0],  { clamp: true });

  return (
    <motion.div
      className="fixed top-5 left-1/2 z-[1000] -translate-x-1/2"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
    >
      {/* No overflow-hidden here — tagline clips itself; tooltip must escape the nav */}
      <motion.nav
        className="bg-[#111111]/90 backdrop-blur-xl border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{ borderRadius }}
      >
        <motion.div
          className="flex items-center gap-4"
          style={{
            paddingLeft:   paddingX,
            paddingRight:  paddingX,
            paddingTop:    paddingY,
            paddingBottom: paddingY,
          }}
        >
          {/* ── Logo ─────────────────────────────── */}
          <div className="flex items-center gap-2.5 shrink-0">
            <motion.img
              src="/favicon.svg"
              alt="PropertyLK"
              className="shrink-0 drop-shadow-sm"
              style={{ width: logoSize, height: logoSize }}
            />
            <span className="text-[14px] font-semibold text-white tracking-tight leading-none whitespace-nowrap">
              PropertyLK
            </span>
          </div>

          {/* ── Tagline (collapses on scroll, hidden on mobile) ─────── */}
          <motion.div
            className="overflow-hidden shrink-0 hidden sm:block"
            style={{ width: taglineWidth }}
            aria-hidden="true"
          >
            <motion.span
              className="block text-[10px] text-[#525252] tracking-[0.16em] uppercase whitespace-nowrap"
              style={{ opacity: taglineOpacity }}
            >
              By Ardeno Studio
            </motion.span>
          </motion.div>

          {/* ── Separator ────────────────────────── */}
          <div className="w-px h-4 bg-white/[0.1] hidden sm:block shrink-0" />

          {/* ── Nav links ────────────────────────── */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {[
              { label: 'Market',   href: '#' },
              { label: 'Trends',   href: '#trends' },
              { label: 'Listings', href: '#listings' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-[13px] text-[#525252] hover:text-white transition-colors px-3 py-1 rounded-full hover:bg-white/[0.06] no-underline"
              >
                {label}
              </a>
            ))}
          </div>

          {/* ── Separator ────────────────────────── */}
          <div className="hidden sm:block w-px h-4 bg-white/[0.1] shrink-0" />

          {/* ── Live indicator ───────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-dot shrink-0" />
            <span className="hidden sm:block text-[11px] text-emerald-400 font-medium tracking-wide">Live</span>
          </div>

          {/* ── GitHub ───────────────────────────── */}
          <div
            className="relative shrink-0"
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
          >
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="group relative flex items-center text-[#525252] hover:text-white transition-colors"
            >
              <span className="absolute -inset-2 rounded-full bg-[#14b8a6]/10 opacity-0 blur-md group-hover:opacity-100 transition-opacity duration-300" />
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" className="relative z-10 transition-transform duration-200 group-hover:scale-110">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>

            {/* Rich tooltip */}
            <AnimatePresence>
              {tooltip && (
                <motion.div
                  className="absolute right-0 top-full mt-3 w-64 pointer-events-none z-50"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] shadow-[0_24px_64px_rgba(0,0,0,0.9)] bg-[#141414]">
                    {/* Teal accent bar */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488]" />

                    <div className="relative p-4">
                      {/* Title */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-3.5 rounded-full bg-[#14b8a6]" />
                        <p className="text-[13px] font-bold text-white tracking-tight">Open Source</p>
                      </div>

                      {/* Description */}
                      <p className="text-[11.5px] text-[#888] leading-snug mb-3 pl-3">
                        Fully open source. Star it on GitHub if you find it useful!
                      </p>

                      {/* CTA button */}
                      <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pointer-events-auto flex items-center justify-between gap-2 w-full
                          bg-[#14b8a6]/[0.08] hover:bg-[#14b8a6]/[0.15]
                          border border-[#14b8a6]/20 hover:border-[#14b8a6]/40
                          backdrop-blur-sm rounded-lg px-3 py-2 transition-colors duration-150 group/btn no-underline"
                      >
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 fill-[#14b8a6] text-[#14b8a6] group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[11.5px] font-semibold text-[#14b8a6]">Star the repo</span>
                        </div>
                        {stars !== null && (
                          <span className="bg-white/[0.06] rounded-full px-2 py-0.5 text-[10px] text-[#a3a3a3] font-medium tabular-nums">
                            {stars.toLocaleString()}
                          </span>
                        )}
                        {stars === null && (
                          <span className="bg-white/[0.06] rounded-full px-2 py-0.5 text-[10px] text-[#525252]">—</span>
                        )}
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.nav>
    </motion.div>
  );
}
