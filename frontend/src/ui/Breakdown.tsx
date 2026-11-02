import type { ReactNode } from 'react'
import './Breakdown.css'

export interface BreakdownItem {
  label: ReactNode
  /** Drives the bar. */
  value: number
  /** What is written at the end of the row; the value by default. */
  display?: ReactNode
}

/** Ranked shares: device models, OS versions, languages. */
export function Breakdown({ title, items }: { title?: ReactNode; items: BreakdownItem[] }) {
  const peak = Math.max(1, ...items.map((i) => i.value))
  return (
    <div>
      {title && <h3 className="bnn-breakdown__title">{title}</h3>}
      <ul className="bnn-breakdown">
        {items.map((item, i) => (
          <li key={i}>
            <div className="bnn-breakdown__row">
              <span className="bnn-breakdown__label">{item.label}</span>
              <span className="bnn-breakdown__value">{item.display ?? item.value}</span>
            </div>
            <div className="bnn-breakdown__track">
              <div className="bnn-breakdown__fill" style={{ width: `${(item.value / peak) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
