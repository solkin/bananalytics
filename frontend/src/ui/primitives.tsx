import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from 'react'
import { StatusGlyph } from './Icon'

/* ---------------------------------------------------------------- cn */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------- Button */
type ButtonVariant = 'primary' | 'default' | 'text' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'bnn-btn',
        `bnn-btn--${variant}`,
        `bnn-btn--${size}`,
        block && 'bnn-btn--block',
        loading && 'is-loading',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="bnn-btn__spinner" aria-hidden />
      ) : icon ? (
        <span className="bnn-btn__icon">{icon}</span>
      ) : null}
      {children != null && <span className="bnn-btn__label">{children}</span>}
    </button>
  )
}

/* --------------------------------------------------------- IconButton */
/** Borderless square button for toolbars and overlay headers. */
export function IconButton({
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={cn('bnn-iconbtn', size === 'sm' && 'bnn-iconbtn--sm', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- Tag */
export type TagTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple'

export function Tag({
  tone = 'neutral',
  children,
  className,
  ...rest
}: { tone?: TagTone } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('bnn-tag', `bnn-tag--${tone}`, className)} {...rest}>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- Badge */
export function Badge({
  count,
  tone = 'danger',
  className,
}: {
  count: number | string
  tone?: TagTone
  className?: string
}) {
  return (
    <span className={cn('bnn-badge', `bnn-badge--${tone}`, className)}>
      {count}
    </span>
  )
}

/* ------------------------------------------------------------ Divider */
export function Divider({
  vertical,
  children,
  className,
}: {
  vertical?: boolean
  children?: ReactNode
  className?: string
}) {
  if (vertical) {
    return <span className={cn('bnn-divider bnn-divider--v', className)} />
  }
  return (
    <div
      className={cn(
        'bnn-divider bnn-divider--h',
        Boolean(children) && 'bnn-divider--text',
        className,
      )}
    >
      {children && <span className="bnn-divider__label">{children}</span>}
    </div>
  )
}

/* ------------------------------------------------------------- Avatar */
export function Avatar({
  size = 28,
  icon,
  children,
  style,
  className,
}: {
  size?: number
  icon?: ReactNode
  children?: ReactNode
  style?: CSSProperties
  className?: string
}) {
  return (
    <span
      className={cn('bnn-avatar', className)}
      style={{ width: size, height: size, fontSize: size * 0.42, ...style }}
    >
      {icon ?? children}
    </span>
  )
}

/* ------------------------------------------------------------ Spinner */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return <span className={cn('bnn-spinner', `bnn-spinner--${size}`, className)} aria-label="loading" />
}

export function Spin({
  spinning = true,
  children,
  tip,
}: {
  spinning?: boolean
  children?: ReactNode
  tip?: string
}) {
  if (!children) {
    return (
      <div className="bnn-spin-center">
        <Spinner size="lg" />
        {tip && <span className="bnn-spin-tip">{tip}</span>}
      </div>
    )
  }
  return (
    <div className="bnn-spin-wrap">
      {children}
      {spinning && (
        <div className="bnn-spin-overlay">
          <Spinner size="lg" />
          {tip && <span className="bnn-spin-tip">{tip}</span>}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- Skeleton */
export function Skeleton({
  rows = 3,
  title = true,
  active = true,
  className,
}: {
  rows?: number
  title?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <div className={cn('bnn-skeleton', active && 'is-active', className)}>
      {title && <div className="bnn-skeleton__title" />}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bnn-skeleton__line"
          style={{ width: i === rows - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonBlock({
  width,
  height = 16,
  radius = 4,
  active = true,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  active?: boolean
}) {
  return (
    <span
      className={cn('bnn-skeleton__block', active && 'is-active')}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

/* ---------------------------------------------------------- Statistic */
export function Statistic({
  title,
  value,
  suffix,
  prefix,
  trend,
  trendTone,
  variant = 'default',
  className,
}: {
  title: ReactNode
  value: ReactNode
  suffix?: ReactNode
  prefix?: ReactNode
  trend?: ReactNode
  trendTone?: 'up' | 'down'
  /** `kpi` is the headline readout next to a chart: label set in small caps,
   *  value large and in the primary colour. */
  variant?: 'default' | 'kpi'
  className?: string
}) {
  return (
    <div className={cn('bnn-stat', variant === 'kpi' && 'bnn-stat--kpi', className)}>
      <div className="bnn-stat__title">{title}</div>
      <div className="bnn-stat__value">
        {prefix && <span className="bnn-stat__affix">{prefix}</span>}
        {value}
        {suffix && <span className="bnn-stat__affix">{suffix}</span>}
      </div>
      {trend != null && (
        <div className={cn('bnn-stat__trend', trendTone && `is-${trendTone}`)}>
          {trend}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- Empty */
export function Empty({
  description = 'No data',
  children,
  className,
}: {
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bnn-empty', className)}>
      <svg className="bnn-empty__icon" viewBox="0 0 64 41" width="64" height="41" aria-hidden>
        <ellipse cx="32" cy="33" rx="32" ry="7" fill="var(--bnn-neutral-soft)" />
        <path
          d="M14 9h36l6 18v8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3v-8L14 9z"
          fill="var(--bnn-surface-alt)"
          stroke="var(--bnn-border-strong)"
          strokeWidth="1.5"
        />
        <path
          d="M8 27h14a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4h14"
          fill="none"
          stroke="var(--bnn-border-strong)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="bnn-empty__text">{description}</div>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------- Alert */
type AlertType = 'info' | 'success' | 'warning' | 'error'

export function Alert({
  type = 'info',
  message,
  description,
  showIcon = true,
  action,
  className,
}: {
  type?: AlertType
  message: ReactNode
  description?: ReactNode
  showIcon?: boolean
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bnn-alert', `bnn-alert--${type}`, className)} role="alert">
      {showIcon && (
        <span className="bnn-alert__icon">
          <StatusGlyph type={type} />
        </span>
      )}
      <div className="bnn-alert__body">
        <div className="bnn-alert__message">{message}</div>
        {description && <div className="bnn-alert__desc">{description}</div>}
      </div>
      {action && <div className="bnn-alert__action">{action}</div>}
    </div>
  )
}

/* ----------------------------------------------------------- Timeline */
export interface TimelineItem {
  content: ReactNode
  meta?: ReactNode
}

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[]
  className?: string
}) {
  return (
    <div className={cn('bnn-timeline', className)}>
      {items.map((it, i) => (
        <div className="bnn-timeline__item" key={i}>
          <span className="bnn-timeline__dot" />
          <div className="bnn-timeline__body">
            <div className="bnn-timeline__content">{it.content}</div>
            {it.meta != null && <div className="bnn-timeline__meta">{it.meta}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- Typography */
export function Title({
  level = 4,
  children,
  className,
  style,
}: {
  level?: 1 | 2 | 3 | 4 | 5
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const Tag = `h${level}` as const
  return (
    <Tag className={cn('bnn-title', `bnn-title--${level}`, className)} style={style}>
      {children}
    </Tag>
  )
}

export function Text({
  type,
  strong,
  size,
  mono,
  children,
  className,
  style,
}: {
  type?: 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger'
  strong?: boolean
  size?: 'sm' | 'md' | 'base' | 'lg'
  mono?: boolean
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={cn(
        'bnn-text',
        type && `bnn-text--${type}`,
        strong && 'bnn-text--strong',
        size && `bnn-text--${size}`,
        mono && 'bnn-mono',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  )
}
