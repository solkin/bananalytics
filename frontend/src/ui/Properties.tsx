import { Fragment, type ReactNode } from 'react'
import { cn } from './cn'
import './Properties.css'

export interface Property {
  label: ReactNode
  value: ReactNode
}

/** Labelled facts: `list` is one per line, `columns` is a short row of metrics. */
export function Properties({
  items,
  layout = 'list',
  className,
}: {
  items: Property[]
  layout?: 'list' | 'columns'
  className?: string
}) {
  return (
    <dl className={cn('bnn-properties', `bnn-properties--${layout}`, className)}>
      {items.map((item, i) =>
        layout === 'columns' ? (
          <div key={i}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ) : (
          <Fragment key={i}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </Fragment>
        ),
      )}
    </dl>
  )
}
