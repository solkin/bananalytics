import {
  useCallback,
  cloneElement,
  isValidElement,
  type AriaAttributes,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn, Button } from './primitives'
import { IconClose } from './Icon'
import { Portal, useDismiss, useEsc, usePopoverPosition } from './portal'
import { uiStrings } from './strings'

/* -------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  confirmLoading,
  okDanger,
  hideFooter,
}: {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: number
  okText?: ReactNode
  cancelText?: ReactNode
  onOk?: () => void
  confirmLoading?: boolean
  okDanger?: boolean
  hideFooter?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEsc(open, onClose, ref)
  if (!open) return null
  return (
    <Portal modal>
      <div className="bnn-overlay" onMouseDown={onClose}>
        <div
          ref={ref}
          className="bnn-modal"
          style={{ width }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
        >
          {title && (
            <div className="bnn-modal__head">
              <div id={titleId} className="bnn-modal__title">{title}</div>
              <button type="button" className="bnn-iconbtn bnn-iconbtn--sm" disabled={!onClose} onClick={onClose} aria-label={uiStrings.close}>
                <IconClose size={16} />
              </button>
            </div>
          )}
          <div className="bnn-modal__body">{children}</div>
          {!hideFooter &&
            (footer !== undefined ? (
              <div className="bnn-modal__foot">{footer}</div>
            ) : (
              <div className="bnn-modal__foot">
                <Button onClick={onClose}>{cancelText}</Button>
                <Button
                  variant={okDanger ? 'danger' : 'primary'}
                  loading={confirmLoading}
                  onClick={onOk}
                >
                  {okText}
                </Button>
              </div>
            ))}
        </div>
      </div>
    </Portal>
  )
}

/* ------------------------------------------------------------- Drawer */
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 360,
  placement = 'right',
  footer,
}: {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children?: ReactNode
  width?: number
  placement?: 'left' | 'right'
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEsc(open, onClose, ref)
  if (!open) return null
  return (
    <Portal modal>
      <div className="bnn-overlay" onMouseDown={onClose}>
        <div
          ref={ref}
          className={cn('bnn-drawer', `bnn-drawer--${placement}`)}
          style={{ width }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
        >
          {title && (
            <div className="bnn-drawer__head">
              <div id={titleId} className="bnn-drawer__title">{title}</div>
              <button type="button" className="bnn-iconbtn bnn-iconbtn--sm" disabled={!onClose} onClick={onClose} aria-label={uiStrings.close}>
                <IconClose size={16} />
              </button>
            </div>
          )}
          <div className="bnn-drawer__body">{children}</div>
          {footer && <div className="bnn-drawer__foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}

/* ------------------------------------------------------------ Tooltip */
export function Tooltip({
  title,
  children,
  placement = 'top',
}: {
  title: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const id = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const trigger = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const close = useCallback(() => setRect(null), [])
  const position = usePopoverPosition(rect, tip, 'center', placement)
  useDismiss(rect != null, [trigger, tip], close)
  useEsc(rect != null, close, tip)
  return (
    <span ref={trigger} className="bnn-tooltip-wrap"
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => { if (!trigger.current?.contains(document.activeElement)) close() }}
      onFocus={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onBlur={close}>
      {isValidElement<AriaAttributes>(children) ? cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], rect ? id : undefined].filter(Boolean).join(' ') || undefined,
      }) : children}
      {rect && <Portal>
        <span ref={tip} id={id} className="bnn-tooltip is-visible" style={position} role="tooltip">{title}</span>
      </Portal>}
    </span>
  )
}

/* ----------------------------------------------------------- Dropdown */
export interface MenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function Dropdown({
  items,
  children,
  placement = 'bottomRight',
  label,
}: {
  items: MenuItem[]
  children: ReactNode
  placement?: 'bottomLeft' | 'bottomRight'
  label?: string
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const menuId = useId()
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const close = useCallback(() => setRect(null), [])
  const position = usePopoverPosition(rect, menuRef, placement === 'bottomRight' ? 'right' : 'left')
  useDismiss(open, [triggerRef, menuRef], close)
  useEsc(open, close, menuRef)
  return (
    <div className="bnn-dropdown" ref={triggerRef}>
      <div
        className={cn('bnn-dropdown__trigger', open && 'is-open')}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(e) => {
          if (['Enter', ' ', 'ArrowDown'].includes(e.key) && triggerRef.current) {
            e.preventDefault()
            setRect(triggerRef.current.getBoundingClientRect())
          }
        }}
        onClick={() =>
          setRect((r) => (r ? null : triggerRef.current!.getBoundingClientRect()))
        }
      >
        {children}
      </div>
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
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation() }
                close()
                triggerRef.current?.querySelector<HTMLElement>('[role="button"]')?.focus()
              }
            }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={cn(
                  'bnn-menu__item',
                  it.danger && 'is-danger',
                  it.disabled && 'is-disabled',
                )}
                disabled={it.disabled}
                onClick={() => {
                  it.onClick?.()
                  close()
                }}
              >
                {it.icon && <span className="bnn-menu__icon">{it.icon}</span>}
                {it.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  )
}

/* --------------------------------------------------------- Popconfirm */
export function Popconfirm({
  title,
  description,
  okText = 'Yes',
  cancelText = 'No',
  okDanger,
  onConfirm,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  okText?: string
  cancelText?: string
  okDanger?: boolean
  onConfirm?: () => void
  children: ReactNode
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const close = useCallback(() => setRect(null), [])
  useDismiss(open, [triggerRef, popRef], close)
  useEsc(open, close, popRef)
  const position = usePopoverPosition(rect, popRef, 'center')

  return (
    <span className="bnn-popconfirm" ref={triggerRef}>
      <span
        onClick={() => {
          const next = rect ? null : triggerRef.current!.getBoundingClientRect()
          setRect(next)
        }}
      >
        {children}
      </span>
      {open && (
        <Portal autoFocus>
          <div
            ref={popRef}
            className="bnn-popconfirm__pop"
            role="dialog"
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              const buttons = popRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
              if (!buttons?.length) return
              const first = buttons[0]
              const last = buttons[buttons.length - 1]
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
            }}
            style={position}
          >
            <div className="bnn-popconfirm__title">{title}</div>
            {description && (
              <div className="bnn-popconfirm__desc">{description}</div>
            )}
            <div className="bnn-popconfirm__actions">
              <Button size="sm" onClick={close}>
                {cancelText}
              </Button>
              <Button
                size="sm"
                variant={okDanger ? 'danger' : 'primary'}
                onClick={() => {
                  onConfirm?.()
                  close()
                }}
              >
                {okText}
              </Button>
            </div>
          </div>
        </Portal>
      )}
    </span>
  )
}

/* --------------------------------------------------------------- Tabs */
export interface TabItem {
  key: string
  label: ReactNode
  children?: ReactNode
}

export function Tabs({
  items,
  activeKey,
  onChange,
  className,
}: {
  items: TabItem[]
  activeKey?: string
  onChange?: (key: string) => void
  className?: string
}) {
  const id = useId()
  const [internal, setInternal] = useState(items[0]?.key)
  const active = activeKey ?? internal
  const set = (k: string) => {
    setInternal(k)
    onChange?.(k)
  }
  const current = items.find((i) => i.key === active)
  return (
    <div className={cn('bnn-tabs', className)}>
      <div className="bnn-tabs__nav" role="tablist">
        {items.map((it, index) => (
          <button
            key={it.key}
            type="button"
            id={`${id}-tab-${index}`}
            role="tab"
            aria-selected={it.key === active}
            aria-controls={`${id}-panel`}
            tabIndex={it.key === active ? 0 : -1}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
              e.preventDefault()
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
                : (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
              set(items[next].key)
              document.getElementById(`${id}-tab-${next}`)?.focus()
            }}
            className={cn('bnn-tabs__tab', it.key === active && 'is-active')}
            onClick={() => set(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {current?.children != null && (
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${items.indexOf(current)}`} tabIndex={0} className="bnn-tabs__panel">{current.children}</div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- Segmented */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { label: ReactNode; value: T }[]
  value: T
  onChange?: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('bnn-segmented', `bnn-segmented--${size}`, className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          className={cn('bnn-segmented__item', o.value === value && 'is-active')}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
