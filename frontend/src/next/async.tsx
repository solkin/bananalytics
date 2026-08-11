import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Empty, Spin } from '@/ui'

/* Tiny data-fetching helper for the new pages — loading / error / empty
   states around the existing @/api clients. */

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface AsyncOpts {
  /** Cache key — same key across pages shares one cached response. */
  key?: string
  /** How long a cached value is served without refetching. Default 60s. */
  ttlMs?: number
}

/* Module-level stale-while-revalidate cache: a keyed hook renders the cached
   value instantly on mount/navigation and only hits the network when the
   entry is stale. In-flight promises are shared so parallel mounts dedupe. */
const swrCache = new Map<string, { time: number; value: unknown }>()
const swrInflight = new Map<string, Promise<unknown>>()

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts?: AsyncOpts) {
  const key = opts?.key
  const ttlMs = opts?.ttlMs ?? 60_000
  const [state, setState] = useState<AsyncState<T>>(() => {
    const entry = key ? swrCache.get(key) : undefined
    return entry
      ? { data: entry.value as T, loading: false, error: null }
      : { data: null, loading: true, error: null }
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    const entry = key ? swrCache.get(key) : undefined
    if (entry) {
      setState({ data: entry.value as T, loading: false, error: null })
      const fresh = Date.now() - entry.time < ttlMs
      if (fresh && nonce === 0) return // served from cache; reload() still forces a refetch
    } else {
      setState((s) => ({ ...s, loading: true, error: null }))
    }
    const pending = key ? (swrInflight.get(key) as Promise<T> | undefined) : undefined
    const run = pending ?? fn()
    if (key && !pending) swrInflight.set(key, run)
    run.then(
      (data) => {
        if (key) {
          swrCache.set(key, { time: Date.now(), value: data })
          swrInflight.delete(key)
        }
        if (alive) setState({ data, loading: false, error: null })
      },
      (err: unknown) => {
        if (key) swrInflight.delete(key)
        if (alive) {
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load' })
        }
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}

export function errorText(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (m) return m
  return e instanceof Error && e.message ? e.message : fallback
}

export function Loaded<T>({
  state,
  emptyText = 'No data',
  children,
}: {
  state: AsyncState<T>
  emptyText?: string
  children: (data: T) => ReactNode
}) {
  /* Spin already centres itself and brings its own padding. */
  if (state.loading) return <Spin tip="Loading…" />

  if (state.error) {
    return <Alert type="error" message="Failed to load" description={state.error} />
  }
  if (state.data == null || (Array.isArray(state.data) && state.data.length === 0)) {
    return <Empty description={emptyText} />
  }
  return <>{children(state.data)}</>
}
