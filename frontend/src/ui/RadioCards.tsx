import { useId, type ReactNode } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import './RadioCards.css'

export interface RadioOption {
  label: ReactNode
  hint?: ReactNode
  value: string | number
  disabled?: boolean
}

/** Options as side-by-side cards, so each can explain what choosing it means. */
export function RadioCards({
  options,
  value,
  onChange,
  className,
}: {
  options: RadioOption[]
  value?: string | number
  onChange?: (value: string | number) => void
  className?: string
}) {
  const field = useField()
  const name = useId()
  return (
    <div {...field} className={cn('bnn-radiocards', className)} role="radiogroup">
      {options.map((o) => (
        <label
          key={String(o.value)}
          className={cn('bnn-radiocard', o.value === value && 'is-checked', o.disabled && 'is-disabled')}
        >
          <input
            type="radio"
            className="bnn-visually-hidden"
            name={name}
            checked={o.value === value}
            disabled={o.disabled}
            onChange={() => onChange?.(o.value)}
          />
          <span className="bnn-radiocard__label">{o.label}</span>
          {o.hint && <span className="bnn-radiocard__hint">{o.hint}</span>}
        </label>
      ))}
    </div>
  )
}
