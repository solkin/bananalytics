import { cn } from './cn'
import { Spinner } from './Spinner'
import './Loading.css'

/** Centered spinner for a whole region. */
export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('bnn-loading', className)}>
      <Spinner size={20} />
    </div>
  )
}
