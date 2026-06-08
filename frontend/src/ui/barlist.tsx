import type { ReactNode } from 'react'
import { cn } from './primitives'

/* App Center–style ranked bar list — devices, countries, languages,
   per-version adoption. Label + proportional track + value + optional
   secondary (percent / change). Zero deps. */

export interface BarListItem {
  label: ReactNode
  /** Numeric magnitude that drives the bar width. */
  value: number
  /** Formatted value shown in the value column (defaults to value). */
  display?: ReactNode
  /** Right-aligned secondary cell — percent, delta, "N/A", etc. */
  secondary?: ReactNode
  /** Per-row bar color override. */
  color?: string
}

export function BarList({
  items,
  max,
  showBar = true,
  className,
}: {
  items: BarListItem[]
  /** Override the denominator for bar widths (defaults to the largest value). */
  max?: number
  showBar?: boolean
  className?: string
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <div className={cn('bnn-barlist', className)}>
      {items.map((it, i) => (
        <div className="bnn-barlist__row" key={i}>
          <span className="bnn-barlist__label" title={typeof it.label === 'string' ? it.label : undefined}>
            {it.label}
          </span>
          {showBar && (
            <span className="bnn-barlist__track">
              <span
                className="bnn-barlist__fill"
                style={{
                  width: `${Math.max(2, (it.value / peak) * 100)}%`,
                  background: it.color,
                }}
              />
            </span>
          )}
          <span className="bnn-barlist__value">{it.display ?? it.value}</span>
          {it.secondary != null && (
            <span className="bnn-barlist__secondary">{it.secondary}</span>
          )}
        </div>
      ))}
    </div>
  )
}
