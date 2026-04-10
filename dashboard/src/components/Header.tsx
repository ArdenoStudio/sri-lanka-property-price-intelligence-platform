import { useState } from 'react';
import { Star } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

export function Header() {
  const [tooltip, setTooltip] = useState(false);

  const { scrollY } = useScroll();
  const raw = useTransform(scrollY, [0, 80], [0, 1], { clamp: true });
  const p   = useSpring(raw, { stiffness: 160, damping: 26, mass: 0.7 });

  const borderRadius = useTransform(p, [0, 1], [16, 9999]);
  const paddingX     = useTransform(p, [0, 1], [24, 20]);
  const paddingY     = useTransform(p, [0, 1], [14, 10]);
  const logoSize     = useTransform(p, [0, 1], [28, 24]);
  const logoRadius   = useTransform(p, [0, 1], [9,   8]);

  const taglineOpacity = useTransform(p, [0, 0.38], [1, 0],   { clamp: true });
  const taglineWidth   = useTransform(p, [0, 0.72], [108, 0],  { clamp: true });

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
            <motion.div
              className="bg-[#14b8a6]/15 border border-[#14b8a6]/25 flex items-center justify-center shrink-0"
              style={{ width: logoSize, height: logoSize, borderRadius: logoRadius }}
            >
              <img src="/favicon.svg" alt="PropertyLK" className="w-3.5 h-3.5" />
            </motion.div>
            <span className="text-[14px] font-semibold text-white tracking-tight leading-none whitespace-nowrap">
              PropertyLK
            </span>
          </div>

          {/* ── Tagline (collapses on scroll) ─────── */}
          <motion.div
            className="overflow-hidden shrink-0"
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
              href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
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
            <div className={`absolute right-0 top-full mt-3 w-56 pointer-events-none transition-all duration-200 z-50 ${
              tooltip ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            }`}>
              <div className="relative bg-[#161616] border border-white/[0.1] rounded-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                {/* Arrow */}
                <div className="absolute -top-[7px] right-4 w-3.5 h-3.5 rotate-45 bg-[#161616] border-l border-t border-white/[0.1]" />
                <p className="text-[12px] font-bold text-white mb-1">Open Source</p>
                <p className="text-[11px] text-[#525252] leading-relaxed mb-3">
                  Fully open source. Star it on GitHub if you find it useful!
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#14b8a6]">
                  <Star className="w-3 h-3 fill-[#14b8a6]" />
                  Star the repo
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.nav>
    </motion.div>
  );
}
