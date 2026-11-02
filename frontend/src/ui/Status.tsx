import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconWarning } from './Icon'
import './Status.css'

/** A short state in words: Published, Draft, Mapping missing. */
export function Status({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'positive' | 'neutral' | 'warning' | 'danger'
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('bnn-status', `bnn-status--${tone}`, className)}>
      {tone === 'warning' ? <IconWarning size={13} /> : tone !== 'danger' && <span className="bnn-status__dot" />}
      {children}
    </span>
  )
}
