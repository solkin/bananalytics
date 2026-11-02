import type { AriaAttributes } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import './Switch.css'

export function Switch({
  checked,
  onChange,
  disabled,
  className,
  ...aria
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
} & AriaAttributes) {
  const field = useField()
  return (
    <button
      type="button"
      {...field}
      {...aria}
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      className={cn('bnn-switch', checked && 'is-on', className)}
      onClick={() => onChange?.(!checked)}
    >
      <span className="bnn-switch__handle" />
    </button>
  )
}
