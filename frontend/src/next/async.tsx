import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Empty, Spin } from '@/ui'

/* Tiny data-fetching helper for the new pages — loading / error / empty
   states around the existing @/api clients. */

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => {
        if (alive) setState({ data, loading: false, error: null })
      },
      (err: unknown) => {
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

export function Loaded<T>({
  state,
  emptyText = 'No data',
  children,
}: {
  state: AsyncState<T>
  emptyText?: string
  children: (data: T) => ReactNode
}) {
  if (state.loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Spin tip="Loading…" />
      </div>
    )
  }
  if (state.error) {
    return <Alert type="error" message="Failed to load" description={state.error} />
  }
  if (state.data == null || (Array.isArray(state.data) && state.data.length === 0)) {
    return <Empty description={emptyText} />
  }
  return <>{children(state.data)}</>
}
