declare module 'react-simple-maps' {
  import type { ReactNode, CSSProperties, MouseEvent } from 'react';

  interface ProjectionConfig {
    center?: [number, number];
    scale?: number;
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    style?: CSSProperties;
    width?: number;
    height?: number;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: GeoFeature[] }) => ReactNode;
  }

  interface GeoFeature {
    rsmKey: string;
    properties: Record<string, unknown>;
    geometry: object;
  }

  interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    cursor?: string;
  }

  interface GeographyProps {
    geography: GeoFeature;
    style?: {
      default?: GeographyStyle;
      hover?: GeographyStyle;
      pressed?: GeographyStyle;
    };
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
    className?: string;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
}
