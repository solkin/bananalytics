import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
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

export function useEsc(active: boolean, onClose?: () => void, scope?: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const portals = document.querySelectorAll('.bnn-portal')
      const top = portals[portals.length - 1]
      if (top && scope?.current && !top.contains(scope.current)) return
      e.preventDefault()
      onClose?.()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
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
    const gap = 8
    const { width, height } = ref.current.getBoundingClientRect()
    let left = align === 'right' ? anchor.right - width
      : align === 'center' ? anchor.left + (anchor.width - width) / 2 : anchor.left
    const below = anchor.bottom + gap
    const above = anchor.top - gap - height
    let top = side === 'top' && above >= gap ? above
      : below + height <= window.innerHeight - gap ? below : above
    if (side === 'left' || side === 'right') {
      const before = anchor.left - gap - width
      const after = anchor.right + gap
      left = side === 'left' && before >= gap ? before
        : after + width <= window.innerWidth - gap ? after : before
      top = anchor.top + (anchor.height - height) / 2
    }
    setPosition({
      left: Math.max(gap, Math.min(left, window.innerWidth - width - gap)),
      top: Math.max(gap, Math.min(top, window.innerHeight - height - gap)),
    })
  }, [anchor, ref, align, side])
  return {
    position: 'fixed',
    ...position,
  }
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
