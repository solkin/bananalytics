import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { EmptyState, Loading, Notice } from '@/ui'

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

/* Account-scoped stale-while-revalidate cache: a keyed hook renders the cached
   value instantly on mount/navigation and only hits the network when the
   entry is stale. In-flight promises are shared so parallel mounts dedupe. */
interface AsyncCache {
  values: Map<string, { time: number; value: unknown }>
  inflight: Map<string, Promise<unknown>>
}

const AsyncCacheContext = createContext<AsyncCache | null>(null)

export function AsyncCacheProvider({ children }: { children: ReactNode }) {
  const [cache] = useState<AsyncCache>(() => ({ values: new Map(), inflight: new Map() }))
  return <AsyncCacheContext.Provider value={cache}>{children}</AsyncCacheContext.Provider>
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts?: AsyncOpts) {
  const cache = useContext(AsyncCacheContext)
  if (!cache) throw new Error('useAsync requires AsyncCacheProvider')
  const { values: swrCache, inflight: swrInflight } = cache
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
      setState({ data: null, loading: true, error: null })
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
  }, [...deps, nonce, key, cache])

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
  preserveHeight = false,
  children,
}: {
  state: AsyncState<T>
  emptyText?: string
  preserveHeight?: boolean
  children: (data: T) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    if (!preserveHeight || state.loading || !ref.current) return
    const element = ref.current
    const measure = () => setHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [preserveHeight, state.loading, state.data])

  let content: ReactNode
  if (state.loading) content = <Loading />
  else if (state.error) content = <Notice tone="error" title="Failed to load.">{state.error}</Notice>
  else if (state.data == null || (Array.isArray(state.data) && state.data.length === 0)) {
    content = <EmptyState title={emptyText} />
  } else content = children(state.data)

  return preserveHeight
    ? <div ref={ref} style={{ minHeight: state.loading ? height : undefined }}>{content}</div>
    : <>{content}</>
}
