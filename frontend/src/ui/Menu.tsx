import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { Portal, useDismiss, useEsc, usePopoverPosition } from './portal'
import './Menu.css'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

/** A button that opens a list of actions. `children` is its content, so it
 *  must not contain another control; style it through `triggerClassName`. */
export function Menu({
  items,
  children,
  align = 'right',
  label,
  triggerClassName,
}: {
  items: MenuItem[]
  children: ReactNode
  align?: 'left' | 'right'
  label?: string
  triggerClassName?: string
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const menuId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const close = useCallback(() => setRect(null), [])
  const position = usePopoverPosition(rect, menuRef, align)
  useDismiss(open, [anchorRef, menuRef], close)
  useEsc(open, close, menuRef)
  return (
    <div className="bnn-menu-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(triggerClassName ?? 'bnn-menu-trigger--plain', open && 'is-open')}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && anchorRef.current) {
            e.preventDefault()
            setRect(anchorRef.current.getBoundingClientRect())
          }
        }}
        onClick={() => setRect((r) => (r ? null : anchorRef.current!.getBoundingClientRect()))}
      >
        {children}
      </button>
      {open && (
        <Portal autoFocus>
          <div
            ref={menuRef}
            className="bnn-menu"
            id={menuId}
            role="menu"
            style={position}
            onKeyDown={(e) => {
              const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
              const index = nodes.indexOf(document.activeElement as HTMLButtonElement)
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault()
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1
                  : (index + (e.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length
                nodes[next]?.focus()
              } else if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                }
                close()
                triggerRef.current?.focus()
              }
            }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={cn('bnn-menu__item', it.danger && 'is-danger')}
                disabled={it.disabled}
                onClick={() => {
                  it.onClick?.()
                  close()
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  )
}
