import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconChevronLeft, IconClose } from './Icon'
import { IconButton } from './IconButton'
import { uiStrings } from './strings'
import './DetailPanel.css'

/** The right side of a SplitView. Closing it reads as "back" when it has
 *  replaced the list on a narrow screen. */
export function DetailPanel({
  title,
  actions,
  onClose,
  children,
  label,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  onClose?: () => void
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <section className={cn('bnn-detail', className)} aria-label={label}>
      <header className="bnn-detail__head">
        {onClose && (
          <span className="bnn-detail__back">
            <IconButton aria-label={uiStrings.back} onClick={onClose}>
              <IconChevronLeft size={14} />
            </IconButton>
          </span>
        )}
        <div className="bnn-detail__title">{title}</div>
        {actions && <div className="bnn-detail__actions">{actions}</div>}
        {onClose && (
          <span className="bnn-detail__close">
            <IconButton aria-label={uiStrings.close} onClick={onClose}>
              <IconClose size={13} />
            </IconButton>
          </span>
        )}
      </header>
      <div className="bnn-detail__body">{children}</div>
    </section>
  )
}
