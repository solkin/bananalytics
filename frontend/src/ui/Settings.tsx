import type { ReactNode } from 'react'
import { cn } from './cn'
import './Settings.css'

/** A titled box of settings rows. */
export function SettingsGroup({
  title,
  children,
  footer,
}: {
  title: ReactNode
  children: ReactNode
  /** The button that saves the group. */
  footer?: ReactNode
}) {
  return (
    <section className="bnn-settings-group">
      <h2 className="bnn-settings-group__title">{title}</h2>
      <div className="bnn-settings-group__rows">{children}</div>
      {footer && <div className="bnn-settings-group__footer">{footer}</div>}
    </section>
  )
}

/** One setting: what it is on the left, its control on the right. */
export function SettingsRow({
  label,
  hint,
  children,
  stretch,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  children?: ReactNode
  /** The control takes half the row, as text fields do. */
  stretch?: boolean
  htmlFor?: string
}) {
  const Label = htmlFor ? 'label' : 'div'
  return (
    <div className={cn('bnn-settings-row', stretch && 'bnn-settings-row--stretch')}>
      <Label className="bnn-settings-row__text" htmlFor={htmlFor}>
        <span className="bnn-settings-row__label">{label}</span>
        {hint && <span className="bnn-settings-row__hint">{hint}</span>}
      </Label>
      {children != null && <div className="bnn-settings-row__control">{children}</div>}
    </div>
  )
}
