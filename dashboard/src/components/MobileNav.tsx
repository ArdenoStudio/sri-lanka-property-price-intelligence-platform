import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InteractiveMenu } from './ui/modern-mobile-menu';
import type { InteractiveMenuItem } from './ui/modern-mobile-menu';
import {
  getActiveDestinationId,
  MOBILE_MORE_ITEM,
  MOBILE_OVERFLOW_ITEMS,
  MOBILE_PRIMARY_ITEMS,
  navigateToDestination,
} from '../lib/siteNavigation';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.hash}`;
  const [sheetContext, setSheetContext] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpen = sheetContext === routeKey;

  const activeDestination = useMemo(
    () => getActiveDestinationId(location.pathname, location.hash),
    [location.pathname, location.hash]
  );

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSheetContext(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const primaryItems: InteractiveMenuItem[] = useMemo(
    () => [
      ...MOBILE_PRIMARY_ITEMS.map((item) => ({
        label: item.label,
        icon: item.icon,
        isActive: activeDestination === item.id,
        action: () => navigateToDestination(item, navigate, location.pathname),
      })),
      {
        label: MOBILE_MORE_ITEM.label,
        icon: MOBILE_MORE_ITEM.icon,
        isActive: MOBILE_OVERFLOW_ITEMS.some((item) => item.id === activeDestination),
        action: () => setSheetContext(menuOpen ? null : routeKey),
      },
    ],
    [activeDestination, location.pathname, menuOpen, navigate, routeKey]
  );

  return (
    <>
      <div className="mobile-nav-wrapper">
        <InteractiveMenu items={primaryItems} accentColor="#14b8a6" />
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[1001] flex items-end sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-nav-sheet-title"
        >
          <button
            type="button"
            onClick={() => setSheetContext(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close mobile navigation"
          />

          <div className="relative z-10 w-full rounded-t-[32px] border border-white/[0.08] bg-[#111111] p-5 shadow-[0_-24px_64px_rgba(0,0,0,0.8)]">
            <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-white/[0.12]" aria-hidden="true" />

            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p
                  id="mobile-nav-sheet-title"
                  className="brand-wordmark text-[1.35rem] leading-none text-white"
                >
                  property.lk
                </p>
                <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-[#737373]">
                  Jump between live market views, methodology, and printable reports.
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSheetContext(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#a3a3a3] transition-colors hover:text-white"
                aria-label="Close navigation sheet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {MOBILE_OVERFLOW_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeDestination === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSheetContext(null);
                      navigateToDestination(item, navigate, location.pathname);
                    }}
                    className={`flex w-full items-center justify-between rounded-3xl border px-4 py-3.5 text-left transition-colors ${
                      isActive
                        ? 'border-[#14b8a6]/30 bg-[#14b8a6]/[0.08] text-white'
                        : 'border-white/[0.08] bg-white/[0.02] text-[#d4d4d4]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${
                          isActive
                            ? 'border-[#14b8a6]/20 bg-[#14b8a6]/[0.08] text-[#5eead4]'
                            : 'border-white/[0.08] bg-white/[0.04] text-[#a3a3a3]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-inherit">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-[#737373]">
                          {item.description}
                        </span>
                      </span>
                    </span>

                    <ChevronRight className="h-4 w-4 shrink-0 text-[#525252]" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
