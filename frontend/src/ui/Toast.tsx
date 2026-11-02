import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconCircleCheck, IconInfo, IconWarning } from './Icon'
import './Toast.css'

/* Imperative notifications: call `toast.success('Saved')` from anywhere and
   render <ToastViewport /> once near the app root. */

type ToastTone = 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface ToastOptions {
  /** Milliseconds on screen; 0 keeps it until the returned function is called. */
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastItem {
  id: number
  tone: ToastTone
  content: ReactNode
  action?: ToastOptions['action']
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

function push(tone: ToastTone, content: ReactNode, fallback: number, options: ToastOptions = {}) {
  const id = ++seq
  items = [...items, { id, tone, content, action: options.action }]
  emit()
  const duration = options.duration ?? fallback
  if (duration > 0) setTimeout(() => remove(id), duration)
  return () => remove(id)
}

export const toast = {
  success: (content: ReactNode, options?: ToastOptions) => push('success', content, 3000, options),
  error: (content: ReactNode, options?: ToastOptions) => push('error', content, 5000, options),
  info: (content: ReactNode, options?: ToastOptions) => push('info', content, 3000, options),
  warning: (content: ReactNode, options?: ToastOptions) => push('warning', content, 4000, options),
  loading: (content: ReactNode, options?: ToastOptions) => push('loading', content, 0, options),
}

const GLYPH: Record<ToastTone, ReactNode> = {
  success: <IconCircleCheck size={14} />,
  error: <IconWarning size={14} />,
  warning: <IconWarning size={14} />,
  info: <IconInfo size={14} />,
  loading: <span className="bnn-toast__spinner" />,
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
    <div className="bnn-toasts">
      {list.map((t) => (
        <div key={t.id} className="bnn-toast" role={t.tone === 'error' ? 'alert' : 'status'}>
          {GLYPH[t.tone]}
          <span className="bnn-toast__content">{t.content}</span>
          {t.action && (
            <button
              type="button"
              className="bnn-toast__action"
              onClick={() => {
                t.action?.onClick()
                remove(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}
