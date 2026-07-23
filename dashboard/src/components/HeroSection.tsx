/**
 * Adapted from Watermelon UI hero-19
 * https://ui.watermelon.sh/block/hero-19
 * Registry: https://registry.watermelon.sh/r/hero-19.json
 *
 * Background: Lotus Tower from Pettah Floating Market, Colombo
 * Wikimedia Commons (Saaremees) — CC-aware local asset for product UI
 */
import { ArrowDown, ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { BRAND_NAME } from '../lib/brand';
import { NAV_DESTINATIONS, navigateToDestination, scrollToAnchor } from '../lib/siteNavigation';

interface NavLink {
  label: string;
  id: keyof typeof NAV_DESTINATIONS;
}

const navLinks: NavLink[] = [
  { label: 'Listings', id: 'listings' },
  { label: 'Map', id: 'map' },
  { label: 'Trends', id: 'trends' },
  { label: 'About', id: 'about' },
  { label: 'Estimate', id: 'estimate' },
];

const sectionVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.14,
    },
  },
};

const navVariants: Variants = {
  hidden: { opacity: 0, y: -12, filter: 'blur(7px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.62, bounce: 0 },
  },
};

const copyVariants: Variants = {
  hidden: { opacity: 0, x: -22, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.78, bounce: 0 },
  },
};

const buildingVariants: Variants = {
  hidden: { opacity: 0, x: 30, y: 18, scale: 1.04, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 1.08, bounce: 0 },
  },
};

const buttonRowVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const buttonVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.58, bounce: 0 },
  },
};

/** Full-bleed Watermelon hero-19, branded for property.lk */
export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
      id="hero"
      className="relative isolate min-h-[100svh] overflow-hidden font-body text-white antialiased"
    >
      <motion.div
        className="relative flex min-h-[100svh] w-full flex-col overflow-hidden px-6 py-4 sm:px-9 lg:px-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.36 }}
        variants={sectionVariants}
      >
        <motion.img
          variants={buildingVariants}
          src="/hero-lotus-tower.jpg"
          alt="Lotus Tower, Colombo, Sri Lanka"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[68%_35%] sm:object-[65%_30%]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/78 via-black/45 to-black/15"
        />

        <motion.nav
          variants={navVariants}
          className="relative z-20 flex min-h-10 w-full items-center justify-between"
          aria-label="Primary"
        >
          <a
            href="/"
            className="brand-wordmark inline-flex min-h-10 items-center gap-2.5 text-lg text-white transition-[opacity,transform] duration-200 ease-out hover:opacity-85 active:scale-[0.96]"
          >
            <BrandMark className="size-8 shrink-0" />
            {BRAND_NAME}
          </a>

          <div className="hidden items-center gap-[2.15rem] lg:flex">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() =>
                  navigateToDestination(NAV_DESTINATIONS[link.id], navigate, '/')
                }
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-normal text-white/90 transition-[opacity,transform] duration-200 ease-out hover:opacity-100 active:scale-[0.96]"
              >
                {link.label}
              </button>
            ))}
          </div>

          <Link
            to="/estimate"
            className="group inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-zinc-100 px-6 text-sm font-normal text-slate-800 shadow-[inset_0_2px_0_0_rgba(255,255,255,1),inset_0_-1px_0_0_rgba(0,0,0,0.2)] transition-[background-color,color,transform] duration-200 ease-out hover:bg-zinc-200 hover:text-slate-950 active:scale-[0.96]"
          >
            Estimate
            <ArrowRight className="size-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </motion.nav>

        <div className="relative z-10 flex flex-1 items-center pt-10 pb-12 sm:pt-14 lg:pt-4">
          <div className="max-w-[39rem]">
            <motion.h1
              variants={copyVariants}
              className="brand-wordmark max-w-[38rem] text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.04em] text-balance text-white"
            >
              {BRAND_NAME}
            </motion.h1>

            <motion.p
              variants={copyVariants}
              className="mt-5 max-w-[32rem] font-display text-[clamp(1.2rem,2.5vw,1.75rem)] font-light leading-snug tracking-wide text-white/92"
            >
              Compare live asking prices across Sri Lanka
            </motion.p>

            <motion.p
              variants={copyVariants}
              className="mt-4 max-w-[28rem] text-[0.85rem] leading-[1.55] font-medium text-pretty text-white/80"
            >
              Cleaned multi-source listings and district trends, updated on a schedule.
            </motion.p>

            <motion.div
              variants={buttonRowVariants}
              className="mt-7 flex flex-wrap items-center gap-5"
            >
              <motion.button
                type="button"
                variants={buttonVariants}
                onClick={() => scrollToAnchor('listings')}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-zinc-100 px-6 text-sm font-normal text-slate-800 shadow-[inset_0_2px_0_0_rgba(255,255,255,1),inset_0_-1px_0_0_rgba(0,0,0,0.2)] transition-[background-color,color,transform] duration-200 ease-out hover:bg-zinc-200 hover:text-slate-950 active:scale-[0.96]"
              >
                Browse listings
              </motion.button>
              <motion.button
                type="button"
                variants={buttonVariants}
                onClick={() => scrollToAnchor('map')}
                className="group inline-flex min-h-11 items-center gap-2 text-sm font-normal text-white/90 transition-[opacity,transform] duration-200 ease-out hover:opacity-100 active:scale-[0.96]"
              >
                Explore map
                <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </motion.button>
            </motion.div>
          </div>
        </div>

        <motion.button
          type="button"
          variants={copyVariants}
          onClick={() => scrollToAnchor('map')}
          className="absolute right-7 bottom-6 z-20 hidden min-h-10 items-center gap-3 text-[0.73rem] font-medium text-white/85 transition-[opacity,transform] duration-200 ease-out hover:opacity-100 active:scale-[0.96] md:inline-flex lg:right-12 lg:bottom-8"
        >
          Scroll to explore
          <ArrowDown className="size-3.5" />
        </motion.button>
      </motion.div>
    </section>
  );
}
