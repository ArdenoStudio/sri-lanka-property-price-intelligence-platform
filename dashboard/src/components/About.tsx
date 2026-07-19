import type { Stats } from '../api';

const GITHUB_URL =
  'https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform';

interface Props {
  stats?: Stats | null;
}

export function About({ stats }: Props) {
  const sampleSize = stats?.total_listings;

  return (
    <section className="border-t border-white/[0.08] pt-16">
      <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] tracking-[-0.03em] leading-[1.05] text-white">
        How the data works
      </h2>
      <p className="mt-5 max-w-2xl font-body text-[15px] leading-relaxed text-[#a3a3a3]">
        property.lk scrapes public listings from major Sri Lankan property sites, then cleans and
        normalises them daily so asking prices, locations, and attributes stay comparable.
        {sampleSize != null && sampleSize > 0 ? (
          <>
            {' '}
            The current sample covers{' '}
            <span className="text-white num">{sampleSize.toLocaleString()}</span> listings.
          </>
        ) : null}
      </p>
      <p className="mt-6">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[13px] text-[#a3a3a3] underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
        >
          View the open-source project on GitHub
        </a>
      </p>
    </section>
  );
}
