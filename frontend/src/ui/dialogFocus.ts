const FOCUSABLE =
  'button:not(:disabled):not([hidden]), a[href]:not([hidden]), input:not(:disabled):not([hidden]):not([type="hidden"]), textarea:not(:disabled):not([hidden]), select:not(:disabled):not([hidden]), [tabindex="0"]:not([hidden])'

/* Starts on a text field when the dialog has one, because that is where the
   person is going to type; otherwise on the first control, which in a
   confirmation is the safe one. */
export function manageDialogFocus(dialog: HTMLElement) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const overflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  const first =
    dialog.querySelector<HTMLElement>(
      '.bnn-dialog__body input:not(:disabled):not([hidden]):not([type="hidden"]), .bnn-dialog__body textarea:not(:disabled)',
    ) ?? dialog.querySelector<HTMLElement>(FOCUSABLE)
  const initial = first ?? dialog
  initial.focus()
  const trap = (e: KeyboardEvent) => {
    const dialogs = document.querySelectorAll('[aria-modal="true"]')
    if (e.key !== 'Tab' || dialogs[dialogs.length - 1] !== dialog) return
    const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0,
    )
    const start = nodes[0]
    const end = nodes[nodes.length - 1]
    if (!start) {
      e.preventDefault()
      dialog.focus()
    } else if (
      e.shiftKey &&
      (document.activeElement === start || document.activeElement === dialog)
    ) {
      e.preventDefault()
      end.focus()
    } else if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault()
      start.focus()
    }
  }
  document.addEventListener('keydown', trap)
  return () => {
    document.removeEventListener('keydown', trap)
    document.body.style.overflow = overflow
    if (previous?.isConnected) previous.focus()
  }
}
