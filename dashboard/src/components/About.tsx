import type { Stats } from '../api';
import { DataFlowBeam } from './DataFlowBeam';

interface Props {
  stats: Stats | null;
}

const INFO_CARDS = [
  {
    index: '01',
    title: 'Updated Daily',
    body: 'Automated scrapers run at 2:00 AM UTC. Data is cleaned, geocoded, and aggregated automatically.',
  },
  {
    index: '02',
    title: 'Data Quality',
    body: 'Outlier detection, duplicate flagging, and price normalization ensure reliable market insights.',
  },
  {
    index: '03',
    title: 'Feedback',
    body: 'Beta release — we\'d love to hear what features you want next.',
    link: { href: 'https://forms.gle/placeholder', label: 'Share feedback →' },
  },
];

export function About({ stats: _stats }: Props) {
  return (
    <section className="border-t border-white/[0.06] pt-16">
      {/* Editorial headline */}
      <div className="mb-16">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#525252] mb-6">
          How It Works
        </p>
        <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.04em] leading-[0.95] text-white">
          Data that moves<br />
          <span className="text-[#525252]">at market speed.</span>
        </h2>
      </div>

      {/* Data flow visualization */}
      <div className="mb-16">
        <DataFlowBeam />
      </div>

      {/* Numbered info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/[0.07] rounded-3xl border border-white/[0.07] overflow-hidden mb-12">
        {INFO_CARDS.map(card => (
          <div key={card.index} className="bg-[#111111] p-8">
            <p className="text-[3.5rem] font-bold text-[#1a1a1a] leading-none mb-6 num">
              {card.index}
            </p>
            <h4 className="text-[15px] font-semibold text-white mb-3">{card.title}</h4>
            <p className="text-[13px] text-[#525252] leading-relaxed">{card.body}</p>
            {card.link && (
              <a
                href={card.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-[13px] text-[#14b8a6] hover:text-[#5eead4] transition-colors no-underline"
              >
                {card.link.label}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Attribution */}
      <p className="text-[11px] text-[#2e2e2e] text-center">
        Built by Ardeno Studio ·{' '}
        <a
          href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#525252] hover:text-[#a3a3a3] transition-colors no-underline"
        >
          Open source on GitHub
        </a>
      </p>
    </section>
  );
}
