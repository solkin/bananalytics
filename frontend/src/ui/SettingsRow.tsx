import type { ReactNode } from 'react'
import { cn } from './cn'
import './Settings.css'

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
