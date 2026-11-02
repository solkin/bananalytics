import type { ReactNode } from 'react'
import { cn } from './cn'
import { uiStrings } from './strings'
import './EmptyState.css'

export function EmptyState({
  title = uiStrings.noData,
  description,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  /** The next step, usually one button. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bnn-empty', className)}>
      <div className="bnn-empty__title">{title}</div>
      {description && <p className="bnn-empty__text">{description}</p>}
      {children && <div className="bnn-empty__action">{children}</div>}
    </div>
  )
}
