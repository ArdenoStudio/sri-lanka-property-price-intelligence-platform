import { motion, useReducedMotion } from 'framer-motion';
import { Github, MessageSquare } from 'lucide-react';

const GITHUB_URL =
  'https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform';
const FEEDBACK_URL = 'https://forms.gle/placeholder';

// ── Blueprint grid (abs. positioned SVG) ───────────────────────────────────
function BlueprintGrid() {
  const prefersReduced = useReducedMotion();
  return (
    <motion.svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: prefersReduced ? 0 : 1.2, ease: 'easeOut' }}
    >
      <defs>
        {/* Fine grid: 24px cells */}
        <pattern
          id="footer-bp-fine"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="0.5"
            strokeOpacity="0.05"
          />
        </pattern>

        {/* Coarse grid: 120px cells */}
        <pattern
          id="footer-bp-coarse"
          width="120"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 120 0 L 0 0 0 120"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="1"
            strokeOpacity="0.12"
          />
        </pattern>

        {/* Vertical fade mask: transparent at top → opaque lower */}
        <linearGradient id="footer-bp-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="35%"  stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="footer-bp-mask">
          <rect width="100%" height="100%" fill="url(#footer-bp-fade)" />
        </mask>
      </defs>

      <g mask="url(#footer-bp-mask)">
        <rect width="100%" height="100%" fill="url(#footer-bp-fine)" />
        <rect width="100%" height="100%" fill="url(#footer-bp-coarse)" />
      </g>
    </motion.svg>
  );
}

// ── Corner crosshair ornaments ─────────────────────────────────────────────
const CROSS_COLOR = 'rgba(20,184,166,0.22)';
const ARM = 10;
const CR  = 3;

function Crosshair() {
  return (
    <svg
      width={ARM * 2 + 2}
      height={ARM * 2 + 2}
      viewBox={`${-ARM - 1} ${-ARM - 1} ${ARM * 2 + 2} ${ARM * 2 + 2}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line x1={-ARM} y1="0" x2={ARM} y2="0" stroke={CROSS_COLOR} strokeWidth="1" />
      <line x1="0" y1={-ARM} x2="0" y2={ARM} stroke={CROSS_COLOR} strokeWidth="1" />
      <circle cx="0" cy="0" r={CR} fill="none" stroke={CROSS_COLOR} strokeWidth="0.75" />
    </svg>
  );
}

function CornerOrnaments() {
  return (
    <>
      <div className="absolute top-6 left-6 pointer-events-none z-[1]"><Crosshair /></div>
      <div className="absolute top-6 right-6 pointer-events-none z-[1]"><Crosshair /></div>
      <div className="absolute bottom-6 left-6 pointer-events-none z-[1]"><Crosshair /></div>
      <div className="absolute bottom-6 right-6 pointer-events-none z-[1]"><Crosshair /></div>
    </>
  );
}

// ── Ruler divider ──────────────────────────────────────────────────────────
const TICKS = 48;

function RulerDivider() {
  return (
    <div className="relative h-5 w-full">
      <svg
        aria-hidden="true"
        className="w-full h-full"
        viewBox="0 0 1200 20"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="0" y1="10" x2="1200" y2="10"
          stroke="rgba(20,184,166,0.15)"
          strokeWidth="1"
        />
        {Array.from({ length: TICKS }, (_, i) => {
          const x        = (i / (TICKS - 1)) * 1200;
          const isMajor  = i % 6 === 0;
          const isQuart  = i % 3 === 0;
          const h        = isMajor ? 6 : isQuart ? 4 : 2;
          const opacity  = isMajor ? 0.3 : isQuart ? 0.2 : 0.1;
          return (
            <line
              key={i}
              x1={x} y1={10 - h / 2}
              x2={x} y2={10 + h / 2}
              stroke="#14b8a6"
              strokeWidth={isMajor ? 1 : 0.75}
              strokeOpacity={opacity}
            />
          );
        })}
      </svg>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[8px] font-mono tracking-[0.15em] uppercase select-none pr-1"
        style={{ color: 'rgba(20,184,166,0.25)' }}>
        SCALE 1:1
      </span>
    </div>
  );
}

// ── Variants ───────────────────────────────────────────────────────────────
const containerVariants = {
  hidden:   {},
  visible:  { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden:   { opacity: 0, y: 8 },
  visible:  { opacity: 1, y: 0 },
};

// ── Footer ─────────────────────────────────────────────────────────────────
export function Footer() {
  const prefersReduced = useReducedMotion();
  const dur = prefersReduced ? 0 : 0.4;
  const spring: [number, number, number, number] = [0.22, 1, 0.36, 1];

  return (
    <footer
      className="relative mt-8 overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}
    >
      <BlueprintGrid />
      <CornerOrnaments />

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: prefersReduced ? 0 : 0.55, ease: spring }}
      >
        <motion.div
          className="py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Left — wordmark */}
          <motion.div variants={itemVariants} transition={{ duration: dur, ease: spring }}>
            <p className="text-[14px] font-semibold text-white tracking-tight">PropertyLK</p>
            <p className="text-[12px] mt-1" style={{ color: '#525252' }}>
              Sri Lanka Property Intelligence
            </p>
          </motion.div>

          {/* Center — links */}
          <motion.div
            className="flex items-center gap-6"
            variants={itemVariants}
            transition={{ duration: dur, ease: spring }}
          >
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] no-underline group transition-colors"
              style={{ color: '#525252' }}
            >
              <Github
                className="w-3.5 h-3.5 transition-colors"
                style={{ color: 'inherit' }}
              />
              <span className="group-hover:text-white transition-colors">GitHub</span>
            </a>
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] no-underline group transition-colors"
              style={{ color: '#525252' }}
            >
              <MessageSquare
                className="w-3.5 h-3.5 transition-colors"
                style={{ color: 'inherit' }}
              />
              <span className="group-hover:text-white transition-colors">Feedback</span>
            </a>
          </motion.div>

          {/* Right — copyright */}
          <motion.a
            href="https://ardeno-studio-website.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-right no-underline group cursor-pointer"
            variants={itemVariants}
            transition={{ duration: dur, ease: spring }}
          >
            <div>
              <p className="text-[12px]" style={{ color: '#525252' }}>
                © {new Date().getFullYear()} Ardeno Studio
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#2e2e2e' }}>
                Made in Sri Lanka
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1500 1500"
              className="opacity-[0.35] group-hover:opacity-70 transition-opacity duration-300"
            style={{ height: 52, width: 'auto', flexShrink: 0 }}
              aria-hidden="true"
            >
              <path
                fill="#ffffff"
                d="M 1114.464844 1093.320312 L 902.367188 666.722656 C 839.917969 722.578125 784.960938 820.574219 788.027344 900.875 L 852.203125 1027.425781 C 854.507812 1031.96875 858.433594 1035.472656 863.210938 1037.246094 L 1089.253906 1121.335938 C 1106.46875 1127.742188 1122.644531 1109.769531 1114.464844 1093.320312 Z M 733.84375 860.191406 C 733.300781 860.992188 732.796875 861.84375 732.347656 862.757812 L 651.828125 1025.953125 C 649.539062 1030.585938 645.566406 1034.179688 640.71875 1035.984375 L 410.511719 1121.617188 C 393.394531 1127.992188 377.25 1110.242188 385.203125 1093.804688 L 726.917969 387.246094 C 734.253906 372.085938 755.8125 371.960938 763.3125 387.042969 L 895.113281 652.152344 C 822.84375 703.808594 766.253906 776.003906 733.84375 860.191406"
              />
            </svg>
          </motion.a>
        </motion.div>
      </motion.div>

    </footer>
  );
}
