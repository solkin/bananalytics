import type { FormEvent, ReactNode } from 'react'
import { cn } from './cn'
import './Form.css'

/** A form whose submit never reloads the page. */
export function Form({
  onSubmit,
  children,
  className,
}: {
  onSubmit?: (e: FormEvent) => void
  children: ReactNode
  className?: string
}) {
  return (
    <form
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
