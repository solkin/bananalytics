import type { ReactNode } from 'react'
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
