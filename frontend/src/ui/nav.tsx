import type { ReactNode } from 'react'
import { cn } from './primitives'

/* Horizontal toolbar menu with selected / hover / pressed states. */

export interface NavItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export function NavMenu({
  items,
  activeKey,
  onChange,
  size = 'md',
  className,
}: {
  items: NavItem[]
  activeKey?: string
  onChange?: (key: string) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <nav className={cn('bnn-navmenu', `bnn-navmenu--${size}`, className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={it.key === activeKey}
          disabled={it.disabled}
          className={cn(
            'bnn-navmenu__item',
            it.key === activeKey && 'is-active',
            it.disabled && 'is-disabled',
          )}
          onClick={() => onChange?.(it.key)}
        >
          {it.icon && <span className="bnn-navmenu__icon">{it.icon}</span>}
          <span className="bnn-navmenu__label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
