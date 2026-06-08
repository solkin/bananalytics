import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { StatusGlyph } from './Icon'

/* Lightweight imperative toast (replaces antd `message`).
   Usage:
     import { toast } from '@/ui'
     toast.success('Saved')
   Render <ToastViewport /> once near the app root. */

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading'

interface ToastItem {
  id: number
  type: ToastType
  content: ReactNode
  duration: number
}

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l(items))
}

function remove(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(type: ToastType, content: ReactNode, duration = 3000) {
  const id = ++seq
  items = [...items, { id, type, content, duration }]
  emit()
  if (duration > 0) {
    setTimeout(() => remove(id), duration)
  }
  return () => remove(id)
}

export const toast = {
  success: (c: ReactNode, d?: number) => push('success', c, d),
  error: (c: ReactNode, d?: number) => push('error', c, d ?? 4000),
  info: (c: ReactNode, d?: number) => push('info', c, d),
  warning: (c: ReactNode, d?: number) => push('warning', c, d),
  loading: (c: ReactNode, d?: number) => push('loading', c, d ?? 0),
}

/* Alias to ease migration from antd `message` */
export const message = toast

const GLYPH: Record<ToastType, ReactNode> = {
  success: <StatusGlyph type="success" />,
  error: <StatusGlyph type="error" />,
  info: <StatusGlyph type="info" />,
  warning: <StatusGlyph type="warning" />,
  loading: <span className="bnn-spinner bnn-spinner--sm" />,
}

export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>(items)
  useEffect(() => {
    listeners.add(setList)
    return () => {
      listeners.delete(setList)
    }
  }, [])

  return createPortal(
    <div className="bnn-toast-viewport">
      {list.map((t) => (
        <div key={t.id} className={`bnn-toast bnn-toast--${t.type}`} role="status">
          <span className="bnn-toast__icon">{GLYPH[t.type]}</span>
          <span className="bnn-toast__content">{t.content}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}
