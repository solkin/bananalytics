import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from './primitives'

/* --------------------------------------------------------------- Card */
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
  bodyStyle?: CSSProperties
  padded?: boolean
  hoverable?: boolean
}

export function Card({
  title,
  subtitle,
  extra,
  bodyStyle,
  padded = true,
  hoverable,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn('bnn-card', hoverable && 'bnn-card--hover', className)}
      {...rest}
    >
      {(title || extra) && (
        <div className="bnn-card__head">
          <div className="bnn-card__head-main">
            {title && <div className="bnn-card__title">{title}</div>}
            {subtitle && <div className="bnn-card__subtitle">{subtitle}</div>}
          </div>
          {extra && <div className="bnn-card__extra">{extra}</div>}
        </div>
      )}
      <div
        className={cn('bnn-card__body', !padded && 'bnn-card__body--flush')}
        style={bodyStyle}
      >
        {children}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Breadcrumb */
export interface BreadcrumbItem {
  label: ReactNode
  href?: string
  onClick?: () => void
}

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  return (
    <nav className={cn('bnn-breadcrumb', className)} aria-label="breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span className="bnn-breadcrumb__item" key={i}>
            {last || (!it.href && !it.onClick) ? (
              <span className={cn('bnn-breadcrumb__text', last && 'is-current')}>
                {it.label}
              </span>
            ) : (
              <a
                className="bnn-breadcrumb__link"
                href={it.href ?? '#'}
                onClick={(e) => {
                  if (it.onClick) {
                    e.preventDefault()
                    it.onClick()
                  }
                }}
              >
                {it.label}
              </a>
            )}
            {!last && <span className="bnn-breadcrumb__sep">/</span>}
          </span>
        )
      })}
    </nav>
  )
}

/* --------------------------------------------------------- PageHeader */
export function PageHeader({
  title,
  subtitle,
  extra,
  breadcrumb,
  onBack,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
  breadcrumb?: ReactNode
  onBack?: () => void
  className?: string
}) {
  return (
    <div className={cn('bnn-pageheader', className)}>
      {breadcrumb && <div className="bnn-pageheader__crumb">{breadcrumb}</div>}
      <div className="bnn-pageheader__row">
        <div className="bnn-pageheader__main">
          {onBack && (
            <button className="bnn-pageheader__back" onClick={onBack} aria-label="back">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="bnn-pageheader__title">{title}</h1>
            {subtitle && <div className="bnn-pageheader__subtitle">{subtitle}</div>}
          </div>
        </div>
        {extra && <div className="bnn-pageheader__extra">{extra}</div>}
      </div>
    </div>
  )
}
