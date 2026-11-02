import type { FormEvent, ReactNode } from 'react'
import { cn } from './cn'
import './Form.css'

/** A form whose submit never reloads the page. */
export function Form({
  id,
  onSubmit,
  children,
  className,
}: {
  /** Lets a submit button outside the form, such as a dialog footer, target it. */
  id?: string
  onSubmit?: (e: FormEvent) => void
  children: ReactNode
  className?: string
}) {
  return (
    <form
      id={id}
      className={cn('bnn-form', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(e)
      }}
    >
      {children}
    </form>
  )
}
