import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import { IconClose } from './Icon'
import { uiStrings } from './strings'
import './Input.css'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  prefix?: ReactNode
  suffix?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  allowClear?: boolean
  onClear?: () => void
}

export function Input({
  prefix,
  suffix,
  size = 'md',
  allowClear,
  onClear,
  className,
  value,
  disabled,
  ...rest
}: InputProps) {
  const field = useField()
  const showClear = allowClear && value != null && String(value).length > 0
  return (
    <span
      className={cn(
        'bnn-input',
        size !== 'md' && `bnn-input--${size}`,
        field['aria-invalid'] && 'is-error',
        disabled && 'is-disabled',
        className,
      )}
    >
      {prefix && <span className="bnn-input__affix">{prefix}</span>}
      <input {...field} className="bnn-input__el" value={value} disabled={disabled} {...rest} />
      {showClear && !disabled && (
        <button type="button" className="bnn-input__button" onClick={onClear} aria-label={uiStrings.clear}>
          <IconClose size={12} />
        </button>
      )}
      {suffix && <span className="bnn-input__affix">{suffix}</span>}
    </span>
  )
}
