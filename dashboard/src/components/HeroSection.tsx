import { BRAND_NAME } from '../lib/brand';
import { scrollToAnchor } from '../lib/siteNavigation';

/** Compact brand intro above the familiar dashboard layout. */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] px-6 pb-10 pt-8 lg:px-8">
      <div aria-hidden className="hero-bleed absolute inset-0 opacity-70" />
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <h1 className="brand-wordmark hero-in text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95] text-white">
          {BRAND_NAME}
        </h1>
        <p className="hero-in hero-in-d1 mt-3 font-body text-[clamp(1.1rem,2.4vw,1.5rem)] font-light tracking-wide text-[#a3a3a3]">
          Market Intelligence
        </p>
        <p className="hero-in hero-in-d2 mt-2 max-w-lg font-body text-[14px] text-[#737373]">
          Compare live asking prices and district trends across Sri Lanka.
        </p>
        <div className="hero-in hero-in-d3 mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => scrollToAnchor('listings')}
            className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-[#e5e5e5]"
          >
            Browse listings
          </button>
          <button
            type="button"
            onClick={() => scrollToAnchor('map')}
            className="rounded-xl border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:border-white/40 hover:bg-white/[0.06]"
          >
            Explore map
          </button>
        </div>
      </div>
    </section>
  );
}
