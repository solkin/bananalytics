import { useId, useRef, type ReactNode } from 'react'
import { Portal, useEsc } from './portal'
import './Dialog.css'

/** A modal dialog. A closed one renders nothing, and leaving `onClose` out
 *  makes it undismissable while work is in progress. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onClose?: () => void
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEsc(open, onClose, ref)
  if (!open) return null
  return (
    <Portal modal>
      <div className="bnn-overlay" onMouseDown={onClose}>
        <div
          ref={ref}
          className="bnn-dialog"
          style={{ maxWidth: width }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <div id={titleId} className="bnn-dialog__title">{title}</div>
          <div className="bnn-dialog__body">{children}</div>
          {footer && <div className="bnn-dialog__foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
