import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  FileText,
  Home,
  Info,
  LayoutGrid,
  Map,
  Menu,
  TrendingUp,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';

export type NavDestinationId =
  | 'home'
  | 'listings'
  | 'map'
  | 'estimate'
  | 'trends'
  | 'about'
  | 'report';

type NavDestinationKind = 'home' | 'section' | 'route';

export interface NavDestination {
  id: NavDestinationId;
  label: string;
  icon: LucideIcon;
  kind: NavDestinationKind;
  hash?: `#${string}`;
  path?: string;
  description?: string;
}

const destinationEntries = [
  [
    'home',
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      kind: 'home',
      path: '/',
      description: 'Back to the live market overview.',
    },
  ],
  [
    'listings',
    {
      id: 'listings',
      label: 'Listings',
      icon: LayoutGrid,
      kind: 'section',
      hash: '#listings',
      description: 'Browse filtered and comparable listings.',
    },
  ],
  [
    'map',
    {
      id: 'map',
      label: 'Map',
      icon: Map,
      kind: 'section',
      hash: '#map',
      description: 'See pricing and inventory by district.',
    },
  ],
  [
    'estimate',
    {
      id: 'estimate',
      label: 'Estimate',
      icon: Calculator,
      kind: 'route',
      path: '/estimate',
      description: 'Generate an estimate from matched listings.',
    },
  ],
  [
    'trends',
    {
      id: 'trends',
      label: 'Trends',
      icon: TrendingUp,
      kind: 'section',
      hash: '#trends',
      description: 'Track market movement across districts.',
    },
  ],
  [
    'about',
    {
      id: 'about',
      label: 'About',
      icon: Info,
      kind: 'section',
      hash: '#about',
      description: 'Methodology, updates, and data coverage.',
    },
  ],
  [
    'report',
    {
      id: 'report',
      label: 'Report',
      icon: FileText,
      kind: 'route',
      path: '/report',
      description: 'Printable report exports for estimates.',
    },
  ],
] as const satisfies readonly (readonly [NavDestinationId, NavDestination])[];

export const NAV_DESTINATIONS = Object.fromEntries(destinationEntries) as Record<
  NavDestinationId,
  NavDestination
>;

export const HEADER_PRIMARY_ITEMS: NavDestination[] = [
  NAV_DESTINATIONS.home,
  NAV_DESTINATIONS.listings,
  NAV_DESTINATIONS.map,
  NAV_DESTINATIONS.estimate,
  NAV_DESTINATIONS.trends,
];

export const HEADER_OVERFLOW_ITEMS: NavDestination[] = [
  NAV_DESTINATIONS.about,
  NAV_DESTINATIONS.report,
];

export const MOBILE_PRIMARY_ITEMS: NavDestination[] = [
  NAV_DESTINATIONS.home,
  NAV_DESTINATIONS.listings,
  NAV_DESTINATIONS.map,
  NAV_DESTINATIONS.estimate,
];

export const MOBILE_OVERFLOW_ITEMS: NavDestination[] = [
  NAV_DESTINATIONS.trends,
  NAV_DESTINATIONS.about,
  NAV_DESTINATIONS.report,
];

export const MOBILE_MORE_ITEM = {
  label: 'More',
  icon: Menu,
};

const SECTION_HASH_TO_DESTINATION: Record<string, NavDestinationId> = {
  '#map': 'map',
  '#trends': 'trends',
  '#listings': 'listings',
  '#about': 'about',
};

export function getActiveDestinationId(
  pathname: string,
  hash: string
): NavDestinationId {
  if (pathname === '/estimate') return 'estimate';
  if (pathname === '/report') return 'report';
  if (pathname.startsWith('/listing/')) return 'listings';
  // Legacy multi-page routes → treat as section intent
  if (pathname === '/browse') return 'listings';
  if (pathname === '/map') return 'map';
  if (pathname === '/trends') return 'trends';
  if (pathname === '/about') return 'about';
  if (pathname === '/' && hash in SECTION_HASH_TO_DESTINATION) {
    return SECTION_HASH_TO_DESTINATION[hash];
  }
  return 'home';
}

export function scrollToAnchor(anchorId: string) {
  let attempts = 0;

  const tryScroll = () => {
    const element = document.getElementById(anchorId);
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  };

  if (tryScroll()) return;

  const retry = () => {
    attempts += 1;
    if (tryScroll() || attempts >= 18) return;
    window.setTimeout(retry, 120);
  };

  window.setTimeout(retry, 80);
}

export function navigateToDestination(
  destination: NavDestination,
  navigate: NavigateFunction,
  pathname: string
) {
  if (destination.kind === 'route' && destination.path) {
    navigate(destination.path);
    return;
  }

  if (destination.kind === 'home') {
    if (pathname === '/') {
      const nextUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate('/');
    return;
  }

  if (destination.kind === 'section' && destination.hash) {
    const anchorId = destination.hash.slice(1);

    if (pathname === '/') {
      const nextUrl = `${window.location.pathname}${window.location.search}${destination.hash}`;
      if (window.location.hash !== destination.hash) {
        window.history.replaceState(null, '', nextUrl);
      }
      scrollToAnchor(anchorId);
      return;
    }

    navigate(`/${destination.hash}`);
  }
}
