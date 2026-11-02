import type { ReactNode } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import { IconCheck } from './Icon'
import './Checkbox.css'

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  className,
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  children?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const field = useField()
  return (
    <label className={cn('bnn-checkbox', disabled && 'is-disabled', className)}>
      <input
        {...field}
        aria-labelledby={children ? undefined : field['aria-labelledby']}
        type="checkbox"
        className="bnn-checkbox__input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="bnn-checkbox__box">
        <IconCheck size={11} strokeWidth={2} />
      </span>
      {children && <span className="bnn-checkbox__label">{children}</span>}
    </label>
  )
}
