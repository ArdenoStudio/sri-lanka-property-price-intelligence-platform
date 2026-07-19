import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CurrencySwitcher } from './CurrencySwitcher';
import {
  getActiveDestinationId,
  HEADER_OVERFLOW_ITEMS,
  HEADER_PRIMARY_ITEMS,
  NAV_DESTINATIONS,
  navigateToDestination,
} from '../lib/siteNavigation';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeKey = `${location.pathname}${location.hash}`;
  const [menuContext, setMenuContext] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuOpen = menuContext === routeKey;

  const activeDestination = useMemo(
    () => getActiveDestinationId(location.pathname, location.hash),
    [location.pathname, location.hash]
  );

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuContext(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuContext(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleDestination = (destinationId: keyof typeof NAV_DESTINATIONS) => {
    navigateToDestination(NAV_DESTINATIONS[destinationId], navigate, location.pathname);
  };

  const sectionMenuActive = activeDestination === 'about' || activeDestination === 'report';
  const mobileContextLabel =
    activeDestination === 'estimate'
      ? 'Estimator'
      : activeDestination === 'report'
        ? 'Report'
        : activeDestination === 'listings'
          ? 'Listings'
          : activeDestination === 'map'
            ? 'Map'
            : activeDestination === 'trends'
              ? 'Trends'
              : activeDestination === 'about'
                ? 'About'
                : 'Market';

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-full focus:bg-[#111111] focus:px-4 focus:py-2 focus:text-[13px] focus:text-white focus:no-underline"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[1000] border-b border-white/[0.06] bg-black/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            onClick={(event) => {
              if (location.pathname === '/') {
                event.preventDefault();
                handleDestination('home');
              }
            }}
            className="flex min-w-0 items-center no-underline"
            aria-label="Nilam home"
          >
            <div className="min-w-0">
              <span className="nilam-wordmark block text-[2rem] leading-none text-white sm:text-[2.25rem]">
                Nilam
              </span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.22em] text-[#737373] sm:text-[11px]">
                Sri Lanka Property Intelligence
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-3">
              <nav
                aria-label="Primary"
                className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#111111]/85 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
              >
                {HEADER_PRIMARY_ITEMS.map((item) => {
                  const isActive = activeDestination === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleDestination(item.id)}
                      className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-white text-black'
                          : 'text-[#a3a3a3] hover:bg-white/[0.06] hover:text-white'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuContext(menuOpen ? null : routeKey)}
                    className={`flex items-center gap-1 rounded-full px-4 py-2 text-[13px] transition-colors ${
                      sectionMenuActive || menuOpen
                        ? 'bg-white text-black'
                        : 'text-[#a3a3a3] hover:bg-white/[0.06] hover:text-white'
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls="header-about-report-menu"
                  >
                    About / Report
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {menuOpen && (
                    <div
                      id="header-about-report-menu"
                      role="menu"
                      aria-label="About and report destinations"
                      className="absolute right-0 top-full mt-3 w-72 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111111] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
                    >
                      {HEADER_OVERFLOW_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeDestination === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuContext(null);
                              handleDestination(item.id);
                            }}
                            className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                              isActive
                                ? 'bg-white text-black'
                                : 'text-[#d4d4d4] hover:bg-white/[0.05]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${
                                isActive
                                  ? 'border-black/10 bg-black/5'
                                  : 'border-white/[0.08] bg-white/[0.03]'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">{item.label}</span>
                              <span
                                className={`mt-1 block text-[11px] leading-relaxed ${
                                  isActive ? 'text-black/65' : 'text-[#737373]'
                                }`}
                              >
                                {item.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            <div className="md:hidden">
              <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3]">
                {mobileContextLabel}
              </span>
            </div>

            <CurrencySwitcher variant="header" />
          </div>
        </div>
      </header>
    </>
  );
}
