import type { ReactNode } from 'react'
import './auth.css'

/** Centred card layout shared by sign in and sign up. */
export function AuthFrame({ sub, children }: { sub?: string; children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <img className="auth-head__logo" src="/banana.svg" alt="" />
          <div className="auth-head__name">Bananalytics</div>
          {sub && <div className="auth-head__sub">{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
