import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, EmptyState, Loading } from '@/ui'

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
  const loadedNonce = useRef(nonce)

  useEffect(() => {
    let alive = true
    /* reload() refreshes what is on screen; only new deps mean there is nothing to show yet. */
    const reloading = loadedNonce.current !== nonce
    loadedNonce.current = nonce
    const entry = key ? swrCache.get(key) : undefined
    if (entry) {
      setState({ data: entry.value as T, loading: false, error: null })
      const fresh = Date.now() - entry.time < ttlMs
      if (fresh && nonce === 0) return // served from cache; reload() still forces a refetch
    } else if (!reloading) {
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
  empty,
  preserveHeight = false,
  children,
}: {
  /** Pass the whole `useAsync` result so the error state can offer a retry. */
  state: AsyncState<T> & { reload?: () => void }
  emptyText?: string
  /** Replaces the plain empty state, usually to offer the next step. */
  empty?: ReactNode
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
  else if (state.error) {
    content = (
      <EmptyState title="Couldn't load this" description={state.error}>
        {state.reload && <Button onClick={state.reload}>Retry</Button>}
      </EmptyState>
    )
  } else if (state.data == null || (Array.isArray(state.data) && state.data.length === 0)) {
    content = empty ?? <EmptyState title={emptyText} />
  } else content = children(state.data)

  return preserveHeight
    ? <div ref={ref} style={{ minHeight: state.loading ? height : undefined }}>{content}</div>
    : <>{content}</>
}
