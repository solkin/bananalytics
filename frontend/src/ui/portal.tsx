import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { manageDialogFocus } from './dialogFocus'

export function Portal({ children, modal = false, autoFocus = false }: { children: ReactNode; modal?: boolean; autoFocus?: boolean }) {
  const [el] = useState(() => document.createElement('div'))
  /* Attached before paint: a floating element that measures itself on mount
     would otherwise size up while still detached, and read a height of 0. */
  useLayoutEffect(() => {
    el.className = 'bnn-portal'
    document.body.appendChild(el)
    const dialog = modal ? el.querySelector<HTMLElement>('[aria-modal="true"]') : null
    const previous = autoFocus && document.activeElement instanceof HTMLElement ? document.activeElement : null
    const restore = dialog ? manageDialogFocus(dialog) : undefined
    if (autoFocus) el.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    return () => {
      restore?.()
      if (previous?.isConnected && el.contains(document.activeElement)) previous.focus()
      document.body.removeChild(el)
    }
  }, [el, modal, autoFocus])
  return createPortal(children, el)
}

/** Closes on Escape, but only the topmost portal when several are stacked. */
export function useEsc(active: boolean, onClose?: () => void, scope?: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active) return
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const portals = document.querySelectorAll('.bnn-portal')
      const top = portals[portals.length - 1]
      if (top && scope?.current && !top.contains(scope.current)) return
      e.preventDefault()
      onClose?.()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [active, onClose, scope])
}

export function usePopoverPosition(
  anchor: DOMRect | null,
  ref: RefObject<HTMLElement>,
  align: 'left' | 'right' | 'center' = 'left',
  side: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const gap = 4
    const margin = 8
    const { width, height } = ref.current.getBoundingClientRect()
    let left = align === 'right' ? anchor.right - width
      : align === 'center' ? anchor.left + (anchor.width - width) / 2 : anchor.left
    const below = anchor.bottom + gap
    const above = anchor.top - gap - height
    let top = side === 'top' && above >= margin ? above
      : below + height <= window.innerHeight - margin ? below : above
    if (side === 'left' || side === 'right') {
      const before = anchor.left - gap - width
      const after = anchor.right + gap
      left = side === 'left' && before >= margin ? before
        : after + width <= window.innerWidth - margin ? after : before
      top = anchor.top + (anchor.height - height) / 2
    }
    setPosition({
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    })
  }, [anchor, ref, align, side])
  return { position: 'fixed', ...position }
}

/* The popover lives in a portal, so containment is checked against both the
   trigger and the floating element. */
export function useDismiss(
  active: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return
    const down = (e: MouseEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return
      onClose()
    }
    const scroll = (e: Event) => {
      /* Scrolling inside the popover itself, such as a long option list, is fine. */
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
  }, [active, onClose])
}
