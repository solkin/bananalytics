import { afterEach } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const containers: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = []
export function mount(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  containers.push({ root, container })
  return {
    root,
    container,
    render: async (next: React.ReactNode = node) => {
      await act(async () => root.render(next))
    },
  }
}
afterEach(async () => {
  for (const { root, container } of containers.splice(0)) {
    await act(async () => root.unmount())
    container.remove()
  }
})
