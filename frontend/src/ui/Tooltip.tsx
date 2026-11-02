import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type ReactNode,
} from 'react'
import { Portal, useDismiss, useEsc, usePopoverPosition } from './portal'
import './Tooltip.css'

export function Tooltip({
  title,
  children,
  placement = 'top',
}: {
  title: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const id = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const trigger = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const close = useCallback(() => setRect(null), [])
  const position = usePopoverPosition(rect, tip, 'center', placement)
  useDismiss(rect != null, [trigger, tip], close)
  useEsc(rect != null, close, tip)
  return (
    <span
      ref={trigger}
      className="bnn-tooltip-anchor"
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => {
        if (!trigger.current?.contains(document.activeElement)) close()
      }}
      onFocus={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onBlur={close}
    >
      {isValidElement<AriaAttributes>(children)
        ? cloneElement(children, {
            'aria-describedby':
              [children.props['aria-describedby'], rect ? id : undefined].filter(Boolean).join(' ') || undefined,
          })
        : children}
      {rect && (
        <Portal>
          <span ref={tip} id={id} className="bnn-tooltip" style={position} role="tooltip">
            {title}
          </span>
        </Portal>
      )}
    </span>
  )
}
