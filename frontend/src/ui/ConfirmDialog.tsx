import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { uiStrings } from './strings'

/** Asks before something that cannot be undone. Focus starts on Cancel. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = uiStrings.confirm,
  danger = true,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      width={420}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>{uiStrings.cancel}</Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="bnn-dialog__text">{description}</p>}
    </Dialog>
  )
}
