import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStatePanelProps {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaHref?: string;
  className?: string;
}

export function EmptyStatePanel({
  eyebrow,
  title,
  body,
  ctaLabel,
  onCta,
  ctaHref,
  className = '',
}: EmptyStatePanelProps) {
  const panelClassName = [
    'flex flex-col items-center justify-center text-center',
    'rounded-[28px] border border-white/[0.08] bg-[#111111]',
    'px-6 py-10 sm:px-10 sm:py-12',
    className,
  ].join(' ').trim();

  const ctaClassName = [
    'font-body inline-flex items-center justify-center gap-2',
    'rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/[0.06]',
    'px-4 py-2.5 text-[13px] font-semibold text-[#5eead4]',
    'transition-colors hover:bg-[#14b8a6]/[0.12] hover:border-[#14b8a6]/50',
  ].join(' ');

  return (
    <div className={panelClassName}>
      <p className="font-body mb-4 text-[11px] uppercase tracking-[0.2em] text-[#525252]">
        {eyebrow}
      </p>
      <h3 className="font-display max-w-[18ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[0.95] text-white">
        {title}
      </h3>
      <p className="font-body mt-4 max-w-[56ch] text-[15px] leading-relaxed text-[#a3a3a3]">
        {body}
      </p>

      {ctaHref ? (
        <Link to={ctaHref} className={`${ctaClassName} mt-6 no-underline`}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button type="button" onClick={onCta} className={`${ctaClassName} mt-6 cursor-pointer`}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
