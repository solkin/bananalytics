import type { ReactNode } from 'react'
import './auth.css'

/** The centered column of the signed-out pages. */
export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="auth">
      <div className="auth__column">
        <div className="auth__head">
          <img src="/banana.svg" alt="" width="40" height="40" />
          <h1 className="auth__title">{title}</h1>
          {subtitle && <p className="auth__subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}
