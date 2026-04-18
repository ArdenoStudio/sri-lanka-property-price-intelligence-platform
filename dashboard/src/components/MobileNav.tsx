import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { InteractiveMenu } from './ui/modern-mobile-menu';
import type { InteractiveMenuItem } from './ui/modern-mobile-menu';
import { Home, Map, TrendingUp, LayoutGrid, Calculator } from 'lucide-react';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems: InteractiveMenuItem[] = useMemo(() => [
    {
      label: 'Home',
      icon: Home,
      action: () => {
        if (location.pathname !== '/') {
          navigate('/');
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Map',
      icon: Map,
      action: () => {
        if (location.pathname !== '/') {
          navigate('/');
          return;
        }
        const el = document.querySelector('.rsm-svg')?.closest('section');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Trends',
      icon: TrendingUp,
      action: () => {
        if (location.pathname !== '/') {
          navigate('/');
          return;
        }
        document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Listings',
      icon: LayoutGrid,
      action: () => {
        if (location.pathname !== '/') {
          navigate('/');
          return;
        }
        document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
    {
      label: 'Estimate',
      icon: Calculator,
      action: () => navigate('/estimate'),
    },
  ], [navigate, location.pathname]);

  return (
    <div className="mobile-nav-wrapper">
      <InteractiveMenu items={menuItems} accentColor="#14b8a6" />
    </div>
  );
}
