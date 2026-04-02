export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary/30 py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          Built by{' '}
          <a
            href="https://github.com/ArdenoStudio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-accent-light transition-colors no-underline"
          >
            Ardeno Studio
          </a>
          {' '}&middot; Data for informational purposes only
        </p>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <a
            href="https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors no-underline text-text-muted"
          >
            Source Code
          </a>
          <span>&middot;</span>
          <span>v0.1.0 Beta</span>
        </div>
      </div>
    </footer>
  );
}
