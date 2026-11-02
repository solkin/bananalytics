import { useId, useState, type ReactNode } from 'react'
import { cn } from './cn'
import './Tabs.css'

export interface TabItem {
  key: string
  label: ReactNode
  /** Secondary number after the label, such as a count. */
  count?: ReactNode
  children?: ReactNode
}

export function Tabs({
  items,
  activeKey,
  onChange,
  label,
  className,
}: {
  items: TabItem[]
  activeKey?: string
  onChange?: (key: string) => void
  label?: string
  className?: string
}) {
  const id = useId()
  const [internal, setInternal] = useState(items[0]?.key)
  const active = activeKey ?? internal
  const select = (key: string) => {
    setInternal(key)
    onChange?.(key)
  }
  const current = items.find((i) => i.key === active)
  return (
    <div className={className}>
      <div className="bnn-tabs" role="tablist" aria-label={label}>
        {items.map((it, index) => (
          <button
            key={it.key}
            type="button"
            id={`${id}-tab-${index}`}
            role="tab"
            aria-selected={it.key === active}
            aria-controls={current?.children != null ? `${id}-panel` : undefined}
            tabIndex={it.key === active ? 0 : -1}
            className={cn('bnn-tab', it.key === active && 'is-active')}
            onClick={() => select(it.key)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
              e.preventDefault()
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
                : (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
              select(items[next].key)
              document.getElementById(`${id}-tab-${next}`)?.focus()
            }}
          >
            {it.label}
            {it.count != null && <span className="bnn-tab__count">{it.count}</span>}
          </button>
        ))}
      </div>
      {current?.children != null && (
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${items.indexOf(current)}`}
          tabIndex={0}
          className="bnn-tabs__panel"
        >
          {current.children}
        </div>
      )}
    </div>
  )
}
