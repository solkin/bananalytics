import type { ReactNode } from 'react'
import { cn } from './cn'
import './PageHeader.css'

/** The top row of a screen: what this is, and what you can do with it. */
export function PageHeader({
  title,
  children,
  className,
}: {
  title: ReactNode
  /** Tabs, filters and actions; they wrap below the title when short of room. */
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('bnn-page-header', className)}>
      <h1 className="bnn-page-header__title">{title}</h1>
      {children}
    </header>
  )
}
