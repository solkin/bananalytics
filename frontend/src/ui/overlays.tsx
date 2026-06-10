import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn, Button } from './primitives'
import { IconClose } from './Icon'
import { Portal, useDismiss, useEsc } from './portal'

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
  useEsc(open, onClose)
  if (!open) return null
  return (
    <Portal>
      <div className="bnn-overlay" onMouseDown={onClose}>
        <div
          className="bnn-modal"
          style={{ width }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
        >
          {title && (
            <div className="bnn-modal__head">
              <div className="bnn-modal__title">{title}</div>
              <button className="bnn-iconbtn" onClick={onClose} aria-label="close">
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
  useEsc(open, onClose)
  if (!open) return null
  return (
    <Portal>
      <div className="bnn-overlay" onMouseDown={onClose}>
        <div
          className={cn('bnn-drawer', `bnn-drawer--${placement}`)}
          style={{ width }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
        >
          {title && (
            <div className="bnn-drawer__head">
              <div className="bnn-drawer__title">{title}</div>
              <button className="bnn-iconbtn" onClick={onClose} aria-label="close">
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
  return (
    <span className={cn('bnn-tooltip-wrap')}>
      {children}
      <span className={cn('bnn-tooltip', `bnn-tooltip--${placement}`)} role="tooltip">
        {title}
      </span>
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
}: {
  items: MenuItem[]
  children: ReactNode
  placement?: 'bottomLeft' | 'bottomRight'
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const close = useCallback(() => setRect(null), [])
  useDismiss(open, [triggerRef, menuRef], close)
  useEsc(open, close)
  return (
    <div className="bnn-dropdown" ref={triggerRef}>
      <div
        className={cn('bnn-dropdown__trigger', open && 'is-open')}
        onClick={() =>
          setRect((r) => (r ? null : triggerRef.current!.getBoundingClientRect()))
        }
      >
        {children}
      </div>
      {open && (
        <Portal>
          <div
            ref={menuRef}
            className="bnn-menu"
            style={{
              position: 'fixed',
              top: rect.bottom + 6,
              ...(placement === 'bottomLeft'
                ? { left: Math.max(8, rect.left) }
                : { right: Math.max(8, window.innerWidth - rect.right) }),
            }}
          >
            {items.map((it) => (
              <button
                key={it.key}
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
  useEsc(open, close)
  const width = 240
  return (
    <span className="bnn-popconfirm" ref={triggerRef}>
      <span
        onClick={() =>
          setRect((r) => (r ? null : triggerRef.current!.getBoundingClientRect()))
        }
      >
        {children}
      </span>
      {open && (
        <Portal>
          <div
            ref={popRef}
            className="bnn-popconfirm__pop"
            role="dialog"
            style={{
              position: 'fixed',
              top: rect.bottom + 8,
              left: Math.min(
                Math.max(rect.left + rect.width / 2, width / 2 + 8),
                window.innerWidth - width / 2 - 8,
              ),
            }}
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
        {items.map((it) => (
          <button
            key={it.key}
            role="tab"
            className={cn('bnn-tabs__tab', it.key === active && 'is-active')}
            onClick={() => set(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {current?.children != null && (
        <div className="bnn-tabs__panel">{current.children}</div>
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
          className={cn('bnn-segmented__item', o.value === value && 'is-active')}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
