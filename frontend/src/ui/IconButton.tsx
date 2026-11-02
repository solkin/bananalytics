import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'
import './IconButton.css'

/** Borderless square button; the label is required because there is no text. */
export function IconButton({
  className,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return (
    <button type={type} className={cn('bnn-iconbtn', className)} {...rest}>
      {children}
    </button>
  )
}
