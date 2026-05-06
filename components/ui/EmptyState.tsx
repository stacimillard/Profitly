import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal mb-4">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-heading font-semibold text-lg text-brand-ink">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-brand-ink/70 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
