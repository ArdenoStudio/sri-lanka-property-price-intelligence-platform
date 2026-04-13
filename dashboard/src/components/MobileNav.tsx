import { useMemo } from 'react';
import { InteractiveMenu } from './ui/modern-mobile-menu';
import type { InteractiveMenuItem } from './ui/modern-mobile-menu';
import { Home, Map, TrendingUp, LayoutGrid, MessageCircle } from 'lucide-react';

export function MobileNav() {
  const menuItems: InteractiveMenuItem[] = useMemo(() => [
    {
      label: 'Home',
      icon: Home,
      action: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      label: 'Map',
      icon: Map,
      action: () => {
        const el = document.querySelector('.leaflet-container')?.closest('section');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Trends',
      icon: TrendingUp,
      action: () => {
        document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Listings',
      icon: LayoutGrid,
      action: () => {
        document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Chat',
      icon: MessageCircle,
      action: () => {
        const fab = document.getElementById('propertylk-ai-fab');
        if (fab) fab.click();
      },
    },
  ], []);

  return (
    <div className="mobile-nav-wrapper">
      <InteractiveMenu items={menuItems} accentColor="#14b8a6" />
    </div>
  );
}
