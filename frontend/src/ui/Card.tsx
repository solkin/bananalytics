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

/* ------------------------------------------------------------- TopBar */
/** Sticky application header. `left` holds brand and context, `right` the
 *  account actions; both are plain slots so pages stay in charge of content. */
export function TopBar({
  left,
  right,
  className,
}: {
  left?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('bnn-topbar', className)}>
      <div className="bnn-topbar__left">{left}</div>
      <div className="bnn-topbar__right">{right}</div>
    </header>
  )
}

/** Vertical hairline between two groups inside the top bar. */
export function TopBarSeparator() {
  return <span className="bnn-topbar__sep" />
}

/* --------------------------------------------------------- Breadcrumb */
export interface BreadcrumbItem {
  label: ReactNode
  href?: string
  onClick?: () => void
}

export function Breadcrumb({
  items,
  truncate,
  className,
}: {
  items: BreadcrumbItem[]
  /** Keep the trail on one line and clip it instead of wrapping — for the
   *  top bar, where the header height is fixed. */
  truncate?: boolean
  className?: string
}) {
  return (
    <nav
      className={cn('bnn-breadcrumb', truncate && 'bnn-breadcrumb--truncate', className)}
      aria-label="breadcrumb"
    >
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

/* PageHeader used to live here. Every page carries its context in the top
   bar's breadcrumb instead, so nothing rendered it — removed rather than
   left in the kit as a second, unused way to title a page. */
