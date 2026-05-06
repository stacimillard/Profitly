type Variant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-brand-teal/10 text-brand-teal',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-brand-yellow/20 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-brand-purple/10 text-brand-purple',
  muted: 'bg-surface-muted text-brand-ink/70',
};

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className ?? '',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
