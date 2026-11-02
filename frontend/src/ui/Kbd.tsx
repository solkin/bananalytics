import type { ReactNode } from 'react'
import './Kbd.css'

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="bnn-kbd">{children}</kbd>
}
