import { useId, type ReactNode } from 'react'
import { cn } from './cn'
import { FieldContext } from './fieldContext'
import './Field.css'

/** Label, control and description, associated for assistive technology. */
export function Field({
  label,
  required,
  error,
  help,
  aside,
  children,
  className,
}: {
  label?: ReactNode
  required?: boolean
  error?: ReactNode
  help?: ReactNode
  /** Right-aligned note on the label row, such as "Optional". */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const labelId = `${id}-label`
  const descriptionId = error || help ? `${id}-description` : undefined
  return (
    <FieldContext.Provider
      value={{
        id,
        labelId: label ? labelId : undefined,
        descriptionId,
        required,
        invalid: Boolean(error),
      }}
    >
      <div className={cn('bnn-field', className)}>
        {(label || aside) && (
          <div className="bnn-field__head">
            {label && (
              <label id={labelId} className="bnn-field__label" htmlFor={id}>
                {label}
              </label>
            )}
            {aside && <span className="bnn-field__aside">{aside}</span>}
          </div>
        )}
        {children}
        {error ? (
          <div id={descriptionId} className="bnn-field__error">{error}</div>
        ) : help ? (
          <div id={descriptionId} className="bnn-field__help">{help}</div>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}
