import { forwardRef, useId } from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-brand-ink mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          'w-full px-4 py-3 rounded-lg border bg-white text-brand-ink placeholder:text-brand-ink/40',
          error ? 'border-red-300' : 'border-surface-border',
          className ?? '',
        ].join(' ')}
        {...props}
      />
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
