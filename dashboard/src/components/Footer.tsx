import ArdenoProductionCredit from './ArdenoProductionCredit';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">

          {/* Left — wordmark */}
          <div>
            <p className="text-[14px] font-semibold text-white tracking-tight">PropertyLK</p>
            <p className="text-[12px] text-[#525252] mt-1">Sri Lanka Property Intelligence</p>
          </div>

          {/* Center — links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#525252] hover:text-white transition-colors no-underline"
            >
              GitHub
            </a>
            <a
              href="https://forms.gle/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#525252] hover:text-white transition-colors no-underline"
            >
              Feedback
            </a>
          </div>

          {/* Right — copyright */}
          <div className="text-right">
            <p className="text-[12px] text-[#525252]">
              © {new Date().getFullYear()} Ardeno Studio
            </p>
            <p className="text-[11px] text-[#2e2e2e] mt-0.5">Made in Sri Lanka</p>
          </div>
        </div>

        {/* Ardeno credit */}
        <div className="mt-10 flex justify-center">
          <ArdenoProductionCredit color="#14b8a6" />
        </div>
      </div>
    </footer>
  );
}
