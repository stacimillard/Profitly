interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted';
}

export function Card({
  variant = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-surface-border shadow-card',
        variant === 'muted' ? 'bg-surface-muted' : 'bg-white',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'px-5 py-4 border-b border-surface-border',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['px-5 py-4', className ?? ''].join(' ')} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'px-5 py-4 border-t border-surface-border',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
