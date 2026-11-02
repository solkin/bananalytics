import type { ReactNode } from 'react'
import { cn } from './cn'
import './Tabs.css'

/** One choice among a few, without panels: a period, a view. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { label: ReactNode; value: T }[]
  value: T
  onChange?: (value: T) => void
  label?: string
  className?: string
}) {
  return (
    <div className={cn('bnn-tabs', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          className={cn('bnn-tab', o.value === value && 'is-active')}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
