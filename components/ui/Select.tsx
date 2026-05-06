import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, id, className, children, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-brand-ink mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={[
            'w-full appearance-none px-4 py-3 pr-10 rounded-lg border bg-white text-brand-ink',
            error ? 'border-red-300' : 'border-surface-border',
            className ?? '',
          ].join(' ')}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-ink/60"
        />
      </div>
      {(error || helperText) && (
        <p
          className={[
            'mt-1 text-sm',
            error ? 'text-red-600' : 'text-brand-ink/60',
          ].join(' ')}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
});
