import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconCircleCheck, IconInfo, IconWarning } from './Icon'
import './Notice.css'

const ICON = {
  info: <IconInfo size={15} />,
  success: <IconCircleCheck size={15} />,
  warning: <IconWarning size={15} />,
  error: <IconWarning size={15} />,
}

/** Inline message that stays on the page, unlike a toast. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ICON
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('bnn-notice', `bnn-notice--${tone}`, className)}
      role={tone === 'error' || tone === 'warning' ? 'alert' : undefined}
    >
      <span className="bnn-notice__icon">{ICON[tone]}</span>
      <div className="bnn-notice__body">
        {title && <span className="bnn-notice__title">{title} </span>}
        {children && <span className="bnn-notice__text">{children}</span>}
      </div>
      {action && <div className="bnn-notice__action">{action}</div>}
    </div>
  )
}
