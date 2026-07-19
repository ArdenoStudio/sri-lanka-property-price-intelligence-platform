const STEPS = [
  {
    number: '01',
    title: 'Browse listings',
    body: 'Filter by district, type, and price to see live asking prices across Sri Lanka.',
  },
  {
    number: '02',
    title: 'Read deal score',
    body: 'See how each ask compares with similar nearby listings—higher or lower than typical.',
  },
  {
    number: '03',
    title: 'Estimate',
    body: 'Run a market estimate from comparable public asks before you inquire or negotiate.',
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="border-t border-white/[0.08] pt-16">
      <h2
        id="how-it-works-heading"
        className="font-display text-[clamp(1.75rem,4vw,2.75rem)] tracking-[-0.03em] leading-[1.05] text-white"
      >
        How it works
      </h2>
      <ol className="mt-10 border-t border-white/[0.08]">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="grid grid-cols-[3rem_1fr] gap-4 border-b border-white/[0.08] py-6 sm:grid-cols-[4rem_minmax(0,12rem)_1fr] sm:gap-8"
          >
            <span className="font-display text-[1.25rem] tracking-tight text-[#525252] num">
              {step.number}
            </span>
            <h3 className="font-body text-[15px] font-medium text-white">{step.title}</h3>
            <p className="col-span-2 max-w-xl font-body text-[14px] leading-relaxed text-[#a3a3a3] sm:col-span-1 sm:col-start-3">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
