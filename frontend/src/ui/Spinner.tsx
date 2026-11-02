import { cn } from './cn'
import { uiStrings } from './strings'
import './Spinner.css'

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('bnn-spinner', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={uiStrings.loading}
    />
  )
}
