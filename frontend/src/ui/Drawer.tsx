import { useRef, type ReactNode } from 'react'
import { Portal, useEsc } from './portal'
import './Drawer.css'

/** A panel sliding in from the left: phone navigation. */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEsc(open, onClose, ref)
  if (!open) return null
  return (
    <Portal modal>
      <div className="bnn-drawer-overlay" onMouseDown={onClose}>
        <div
          ref={ref}
          className="bnn-drawer"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </Portal>
  )
}
