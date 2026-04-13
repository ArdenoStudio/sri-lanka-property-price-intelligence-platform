import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Home, Map, TrendingUp, LayoutGrid, MessageCircle } from 'lucide-react';

type IconComponentType = React.ElementType<{ className?: string }>;

export interface InteractiveMenuItem {
  label: string;
  icon: IconComponentType;
  action?: () => void;
}

export interface InteractiveMenuProps {
  items?: InteractiveMenuItem[];
  accentColor?: string;
}

const defaultItems: InteractiveMenuItem[] = [
  { label: 'Home', icon: Home },
  { label: 'Map', icon: Map },
  { label: 'Trends', icon: TrendingUp },
  { label: 'Listings', icon: LayoutGrid },
  { label: 'Chat', icon: MessageCircle },
];

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ items, accentColor }) => {
  const finalItems = useMemo(() => {
    const isValid = items && Array.isArray(items) && items.length >= 2 && items.length <= 5;
    if (!isValid) return defaultItems;
    return items;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= finalItems.length) setActiveIndex(0);
  }, [finalItems, activeIndex]);

  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const setLineWidth = () => {
      const activeItemElement = itemRefs.current[activeIndex];
      const activeTextElement = textRefs.current[activeIndex];
      if (activeItemElement && activeTextElement) {
        const textWidth = activeTextElement.offsetWidth;
        activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`);
      }
    };
    setLineWidth();
    window.addEventListener('resize', setLineWidth);
    return () => window.removeEventListener('resize', setLineWidth);
  }, [activeIndex, finalItems]);

  const handleItemClick = useCallback((index: number) => {
    setActiveIndex(index);
    finalItems[index]?.action?.();
  }, [finalItems]);

  const navStyle = useMemo(() => {
    const color = accentColor || '#14b8a6';
    return { '--mobile-menu-accent': color } as React.CSSProperties;
  }, [accentColor]);

  return (
    <nav
      className="mobile-menu"
      role="navigation"
      aria-label="Mobile navigation"
      style={navStyle}
    >
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex;
        const IconComponent = item.icon;

        return (
          <button
            key={item.label}
            className={`mobile-menu__item ${isActive ? 'active' : ''}`}
            onClick={() => handleItemClick(index)}
            ref={(el) => { itemRefs.current[index] = el; }}
            style={{ '--lineWidth': '0px' } as React.CSSProperties}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="mobile-menu__icon">
              <IconComponent className="mobile-menu__icon-svg" />
            </div>
            <strong
              className={`mobile-menu__text ${isActive ? 'active' : ''}`}
              ref={(el) => { textRefs.current[index] = el; }}
            >
              {item.label}
            </strong>
          </button>
        );
      })}
    </nav>
  );
};

export { InteractiveMenu };
