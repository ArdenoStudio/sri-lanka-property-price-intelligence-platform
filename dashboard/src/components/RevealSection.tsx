interface Props {
  children: React.ReactNode;
  className?: string;
}

export function RevealSection({ children, className = '' }: Props) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
