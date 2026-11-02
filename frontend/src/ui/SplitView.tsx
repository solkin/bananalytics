import type { ReactNode } from 'react'
import { cn } from './cn'
import './SplitView.css'

/** A list and the details of its current item, each scrolling on its own.
 *  Short of room the details replace the list instead of squeezing it. */
export function SplitView({
  list,
  detail,
  detailWidth = 460,
  className,
}: {
  list: ReactNode
  detail?: ReactNode
  detailWidth?: number
  className?: string
}) {
  return (
    <div className={cn('bnn-split', detail != null && 'has-detail', className)}>
      <div className="bnn-split__list">{list}</div>
      {detail != null && (
        <div className="bnn-split__detail" style={{ flexBasis: detailWidth }}>
          {detail}
        </div>
      )}
    </div>
  )
}
