import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export function Portal({ children }: { children: ReactNode }) {
  const [el] = useState(() => document.createElement('div'))
  useEffect(() => {
    el.className = 'bnn-portal'
    document.body.appendChild(el)
    return () => {
      document.body.removeChild(el)
    }
  }, [el])
  return createPortal(children, el)
}

export function useEsc(active: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [active, onClose])
}

/* Dismiss a portal popover: outside mousedown, scroll or resize. The
   popover lives in a portal, so containment is checked against both the
   trigger and the floating element. */
export function useDismiss(
  active: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (refs.some((r) => r.current?.contains(t))) return
      onClose()
    }
    const scroll = (e: Event) => {
      /* Scrolling inside the popover itself (e.g. a long option list) is fine. */
      if (refs.some((r) => r.current?.contains(e.target as Node))) return
      onClose()
    }
    document.addEventListener('mousedown', down)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', onClose)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onClose])
}
