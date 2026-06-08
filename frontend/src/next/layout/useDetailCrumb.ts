import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

/* Detail pages call useDetailCrumb('click-tab-store') to append a trailing
   segment to the shell breadcrumb; it clears automatically on unmount. */

export interface ShellContext {
  setDetail: (label: string | null) => void
}

export function useDetailCrumb(label: string | null) {
  const { setDetail } = useOutletContext<ShellContext>()
  useEffect(() => {
    setDetail(label)
    return () => setDetail(null)
  }, [label, setDetail])
}
