import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/* Sticky page filters: the URL is the source of truth (shareable links),
   localStorage seeds the defaults when the URL carries no parameters. */
export function useStickyFilters(storageKey: string) {
  const [params, setParams] = useSearchParams()
  const hasUrl = [...params.keys()].length > 0

  const stored = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}')
    } catch {
      return {}
    }
  }, [storageKey])

  const get = (key: string, fallback = ''): string =>
    params.get(key) ?? (hasUrl ? fallback : stored[key] ?? fallback)

  const set = (updates: Record<string, string | undefined>) => {
    /* Start from the effective state so stored-only values survive the
       first explicit change. */
    const next = hasUrl ? new URLSearchParams(params) : new URLSearchParams(stored)
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
    try {
      const merged: Record<string, string> = {}
      next.forEach((v, k) => {
        merged[k] = v
      })
      localStorage.setItem(storageKey, JSON.stringify(merged))
    } catch {
      /* storage unavailable — filters just won't persist */
    }
  }

  return { get, set }
}
