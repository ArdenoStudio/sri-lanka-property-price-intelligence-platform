/** property.lk brand mark — custom house/plot glyph (ink on charcoal). */
export function BrandMark({
  className = 'size-8',
  title = 'property.lk',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <rect width="64" height="64" rx="16" fill="#111111" />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        stroke="#ffffff"
        strokeOpacity="0.16"
      />

      {/* Roof */}
      <path
        d="M14 30.5 L32 15 L50 30.5"
        stroke="#f5f5f5"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Walls */}
      <path
        d="M19 29.5 V46.5 H45 V29.5"
        stroke="#f5f5f5"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Door */}
      <path
        d="M29 46.5 V36.5 H35 V46.5"
        stroke="#f5f5f5"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Plot / foundation */}
      <path
        d="M12 51.5 H52"
        stroke="#f5f5f5"
        strokeWidth="3.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
