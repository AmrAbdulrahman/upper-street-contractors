'use client';

/** Small Tailwind-only UI primitives. No custom CSS — consumers' Tailwind scans these. */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export const cls = {
  input:
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:opacity-50',
  label: 'block text-sm font-medium text-neutral-700',
  card: 'rounded-lg border border-neutral-200 bg-white',
} as const;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'ghost' | 'danger' | 'outline';

const variants: Record<Variant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
  outline: 'border border-neutral-300 text-neutral-800 hover:bg-neutral-100',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
  danger: 'text-red-600 hover:bg-red-50',
};

export function Button({
  variant = 'outline',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(cls.input, className)} {...p} />;
}

export function Textarea({
  className,
  ...p
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(cls.input, 'min-h-24', className)} {...p} />;
}

export function Select({
  className,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(cls.input, className)} {...p} />;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  } as const;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  required,
  error,
  badge,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  /** Optional chip shown beside the label, e.g. the field's type. */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className={cx(cls.label, 'flex items-center gap-2')}>
        <span>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {badge}
      </span>
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Spinner() {
  return (
    <div
      className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800"
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}
