import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../lib/brand';

/** Full-bleed brand hero — no stats, cards, or overlays. */
export function HeroSection() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-end overflow-hidden px-6 pb-16 md:pb-24 lg:px-8">
      <div aria-hidden className="hero-bleed absolute inset-0" />
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <h1 className="brand-wordmark hero-in text-[clamp(3.5rem,12vw,8rem)] leading-[0.9] text-white">
          {BRAND_NAME}
        </h1>
        <p className="hero-in hero-in-d1 mt-4 font-body text-[clamp(1.25rem,3vw,1.75rem)] font-light tracking-wide text-[#a3a3a3]">
          Market Intelligence
        </p>
        <p className="hero-in hero-in-d2 mt-3 max-w-md font-body text-[15px] text-[#737373]">
          Compare live asking prices and district trends across Sri Lanka.
        </p>
        <div className="hero-in hero-in-d3 mt-8 flex flex-wrap gap-3">
          <Link
            to="/browse"
            className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-medium text-black no-underline transition-colors hover:bg-[#e5e5e5]"
          >
            Browse
          </Link>
          <Link
            to="/map"
            className="rounded-xl border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white no-underline transition-colors hover:border-white/40 hover:bg-white/[0.06]"
          >
            Map
          </Link>
        </div>
      </div>
    </section>
  );
}
