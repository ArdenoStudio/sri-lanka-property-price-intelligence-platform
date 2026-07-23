/** Inline property.lk mark — house on a plot, ink/paper. */
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
      <rect width="64" height="64" rx="14" fill="#0a0a0a" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="12.5"
        stroke="#fff"
        strokeOpacity="0.14"
      />
      <rect x="14" y="46" width="36" height="4" rx="1.5" fill="#f5f5f5" />
      <path
        fill="#f5f5f5"
        d="M18 45V30.2L32 18l14 12.2V45H40.5V34.5h-9V45H18z"
      />
      <rect x="28.5" y="37" width="7" height="8" rx="1" fill="#0a0a0a" />
      <rect x="38" y="22" width="3.5" height="8" rx="1" fill="#f5f5f5" />
    </svg>
  );
}
