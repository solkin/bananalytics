import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AriaAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { IconCheck, IconChevronDown, IconClose } from './Icon'
import { useField } from './field'
import { Portal, useDismiss, usePopoverPosition } from './portal'
import { cn } from './primitives'
import { uiStrings } from './strings'

export interface SelectOption {
  label: ReactNode
  value: string | number
  disabled?: boolean
}

export interface SelectProps extends AriaAttributes {
  id?: string
  options: SelectOption[]
  value?: string | number | null
  onChange?: (value: string | number) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  allowClear?: boolean
  status?: 'error'
  style?: CSSProperties
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = uiStrings.select,
  size = 'md',
  disabled,
  allowClear,
  status,
  style,
  className,
  ...aria
}: SelectProps) {
  const field = useField()
  const menuId = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [active, setActive] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = rect != null
  const selected = options.find((o) => o.value === value)
  const close = useCallback(() => setRect(null), [])
  useDismiss(open, [ref, menuRef], close)
  const position = usePopoverPosition(rect, menuRef)
  useLayoutEffect(() => {
    if (open && active >= 0)
      menuRef.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = (last = false) => {
    if (!ref.current || disabled) return
    const selectedIndex = options.findIndex((o) => o.value === value && !o.disabled)
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
    setActive(selectedIndex >= 0 ? selectedIndex : (enabled[last ? enabled.length - 1 : 0] ?? -1))
    setRect(ref.current.getBoundingClientRect())
  }
  const move = (direction: number) => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
    if (!enabled.length) return
    const index = enabled.indexOf(active)
    const next = enabled[(index + direction + enabled.length) % enabled.length]
    setActive(next)
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange?.(option.value)
    close()
    buttonRef.current?.focus()
  }

  return (
    <div
      ref={ref}
      className={cn(
        'bnn-select',
        `bnn-select--${size}`,
        open && 'is-open',
        disabled && 'is-disabled',
        (status === 'error' || field['aria-invalid']) && 'is-error',
        className,
      )}
      style={style}
    >
      <button
        {...field}
        {...aria}
        ref={buttonRef}
        type="button"
        className="bnn-select__control"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (!open) return
            e.preventDefault()
            e.stopPropagation()
            close()
            return
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
            e.preventDefault()
            if (e.key === 'Enter' || e.key === ' ') {
              if (open) choose(active)
              else show()
            } else if (!open) show(e.key === 'End' || e.key === 'ArrowUp')
            else if (e.key === 'Home' || e.key === 'End') {
              const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
              setActive(enabled[e.key === 'Home' ? 0 : enabled.length - 1] ?? -1)
            } else move(e.key === 'ArrowDown' ? 1 : -1)
          } else if (e.key === 'Tab') close()
          else if (open && e.key.length === 1) {
            const search = e.key.toLocaleLowerCase()
            const next = options.findIndex(
              (o, i) =>
                i > active &&
                !o.disabled &&
                typeof o.label === 'string' &&
                o.label.toLocaleLowerCase().startsWith(search),
            )
            const first = options.findIndex(
              (o) =>
                !o.disabled &&
                typeof o.label === 'string' &&
                o.label.toLocaleLowerCase().startsWith(search),
            )
            if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first)
          }
        }}
      >
        <span className={cn('bnn-select__value', !selected && 'is-placeholder')}>
          {selected ? selected.label : placeholder}
        </span>
        <IconChevronDown size={16} className="bnn-select__arrow" aria-hidden />
      </button>
      {allowClear && selected && !disabled && (
        <button
          type="button"
          className="bnn-select__clear"
          aria-label={uiStrings.clear}
          onClick={() => {
            onChange?.('')
            close()
            buttonRef.current?.focus()
          }}
        >
          <IconClose size={14} aria-hidden />
        </button>
      )}
      {open && (
        <Portal>
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-labelledby={field['aria-labelledby']}
            aria-label={field['aria-labelledby'] ? undefined : (aria['aria-label'] ?? placeholder)}
            className="bnn-select__menu"
            style={{ ...position, width: rect.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.length === 0 && <div className="bnn-select__empty">{uiStrings.noOptions}</div>}
            {options.map((o, i) => (
              <div
                key={String(o.value)}
                id={`${menuId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={cn(
                  'bnn-select__option',
                  o.value === value && 'is-selected',
                  i === active && 'is-active',
                  o.disabled && 'is-disabled',
                )}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {o.value === value && <IconCheck size={14} aria-hidden />}
              </div>
            ))}
          </div>
        </Portal>
      )}
    </div>
  )
}
