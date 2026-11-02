import type { TextareaHTMLAttributes } from 'react'
import { cn } from './cn'
import { useField } from './fieldContext'
import './Textarea.css'

export function Textarea({
  className,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useField()
  return (
    <textarea
      {...field}
      rows={rows}
      className={cn('bnn-textarea', field['aria-invalid'] && 'is-error', className)}
      {...rest}
    />
  )
}
