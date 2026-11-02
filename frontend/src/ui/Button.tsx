import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid'
  size?: 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  block,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'bnn-btn',
        `bnn-btn--${variant}`,
        size === 'lg' && 'bnn-btn--lg',
        block && 'bnn-btn--block',
        loading && 'is-loading',
        className,
      )}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* The label stays in the layout while loading, so the button keeps its width. */}
      <span className="bnn-btn__content">
        {icon}
        {children}
      </span>
      {loading && <span className="bnn-btn__spinner" aria-hidden />}
    </button>
  )
}
