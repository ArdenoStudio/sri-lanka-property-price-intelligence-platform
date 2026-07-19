import { useId, useState } from 'react';

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do you estimate a property\'s price?',
    answer:
      'We compare a listing against similar recent asks in the same district and property type—factoring in size, bedrooms where available, and the local price distribution. The result is a market-based estimate from public asking prices, not a formal appraisal.',
  },
  {
    question: 'What does the deal score mean?',
    answer:
      'Deal score shows how a listing\'s asking price sits relative to comparable homes nearby. Lower scores suggest the ask is higher than typical comps; higher scores suggest it is closer to—or below—the usual range for similar properties.',
  },
  {
    question: 'Where does the data come from?',
    answer:
      'Listings are collected from publicly available pages on major Sri Lankan property portals. We store asking prices and listing details as published by those sites, then clean duplicates, outliers, and inconsistent fields before they appear here.',
  },
  {
    question: 'How often are prices updated?',
    answer:
      'Scrapers and cleaning jobs run on a daily schedule. Fresh asks and price changes usually show up within about a day of appearing on the source sites, depending on each source\'s availability.',
  },
  {
    question: 'Why might my estimate differ from an asking price?',
    answer:
      'Asking prices reflect seller expectations. Estimates reflect what similar properties are currently listed for. Differences can come from unique features, condition, negotiation room, thin local samples, or listings that are priced above or below the local norm.',
  },
  {
    question: 'Is this an official valuation?',
    answer:
      'No. property.lk provides market intelligence from public listing data. It is not a bank valuation, government assessment, or licensed appraisal, and should not be treated as one for lending or legal decisions.',
  },
];

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b border-white/[0.08]">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-baseline justify-between gap-6 py-5 text-left cursor-pointer"
      >
        <span className="font-body text-[15px] text-white">{question}</span>
        <span
          aria-hidden
          className="shrink-0 font-body text-[13px] text-[#737373] tabular-nums"
        >
          {open ? '−' : '+'}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-5"
      >
        <p className="max-w-2xl font-body text-[14px] leading-relaxed text-[#a3a3a3]">{answer}</p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section aria-labelledby="faq-heading" className="border-t border-white/[0.08] pt-16">
      <h2
        id="faq-heading"
        className="font-display text-[clamp(1.75rem,4vw,2.75rem)] tracking-[-0.03em] leading-[1.05] text-white"
      >
        Frequently asked
      </h2>
      <div className="mt-8 border-t border-white/[0.08]">
        {FAQS.map((faq, index) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
            open={openIndex === index}
            onToggle={() => setOpenIndex((prev) => (prev === index ? null : index))}
          />
        ))}
      </div>
    </section>
  );
}
