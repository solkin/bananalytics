import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { mount } from './dom'
import { AsyncCacheProvider, useAsync } from '../src/next/async'
import { Table } from '../src/ui/Table'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import IssuesPage from '../src/next/pages/IssuesPage'
import IssueDetailPage from '../src/next/pages/IssueDetailPage'
import api from '../src/api/client'

function Data({ load, cacheKey = 'private' }: { load: () => Promise<string>; cacheKey?: string }) {
  const state = useAsync(load, [], { key: cacheKey })
  return <span>{state.loading ? 'loading' : state.data ?? state.error}</span>
}

test('account-scoped caches never reuse a previous account response', async () => {
  const view = mount(<></>)
  await view.render(<AsyncCacheProvider key="A"><Data load={async () => 'A secret'} /></AsyncCacheProvider>)
  assert.match(view.container.textContent!, /A secret/)
  let calls = 0
  await view.render(<AsyncCacheProvider key="B"><Data load={async () => { calls++; return 'B data' }} /></AsyncCacheProvider>)
  assert.equal(calls, 1)
  assert.equal(view.container.textContent, 'B data')
})

test('late responses from a previous account cannot populate the new cache', async () => {
  let finish!: (value: string) => void
  const pending = new Promise<string>((resolve) => { finish = resolve })
  const view = mount(<></>)
  await view.render(<AsyncCacheProvider key="A"><Data load={() => pending} /></AsyncCacheProvider>)
  await view.render(<AsyncCacheProvider key="B"><Data load={async () => 'B data'} /></AsyncCacheProvider>)
  await act(async () => finish('A secret'))
  assert.equal(view.container.textContent, 'B data')
})

test('parallel hooks deduplicate requests within one account', async () => {
  let calls = 0
  const load = async () => { calls++; return 'shared' }
  const view = mount(<AsyncCacheProvider><Data load={load} /><Data load={load} /></AsyncCacheProvider>)
  await view.render()
  assert.equal(calls, 1)
  assert.equal(view.container.textContent, 'sharedshared')
})

test('controlled table sorting and pagination are delegated to the server', async () => {
  const changes: string[] = []
  const view = mount(<Table columns={[{ key: 'count', title: 'Count', sorter: true, render: (r: number) => r }]}
    data={[9, 1]} rowKey={(r) => r}
    pagination={{ page: 1, pageSize: 2, total: 120, onChange: (page) => changes.push(`page:${page}`) }}
    sort={{ key: 'count', direction: 'desc', onChange: (key, direction) => changes.push(`${key}:${direction}`) }} />)
  await view.render()
  await act(async () => view.container.querySelector('th')!.click())
  const buttons = view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')
  await act(async () => buttons[1].click())
  assert.deepEqual(changes, ['count:asc', 'page:2'])
  assert.deepEqual([...view.container.querySelectorAll('tbody td')].map((td) => td.textContent), ['9', '1'])
  assert.match(view.container.textContent!, /of 120/)
})

function respond(handler: (url: string, params: Record<string, unknown>) => unknown) {
  api.defaults.adapter = async (config) => ({ data: handler(config.url!, config.params ?? {}), status: 200, statusText: 'OK', headers: {}, config })
}
const group = { id: 'issue', app_id: 'app', exception_class: 'Error', exception_message: 'failure', first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), occurrences: 120, affected_devices: 1, status: 'open' }

test('issues request subsequent pages and sort the full dataset on the server', async () => {
  const requests: Record<string, unknown>[] = []
  respond((url, params) => {
    if (url.endsWith('/crashes')) { requests.push({ ...params }); return { items: [group], total: 125, page: params.page, page_size: 15 } }
    return []
  })
  const view = mount(<AsyncCacheProvider><MemoryRouter initialEntries={['/apps/app/diagnostics/issues']}>
    <Routes><Route path="/apps/:appId/diagnostics/issues" element={<IssuesPage />} /></Routes>
  </MemoryRouter></AsyncCacheProvider>)
  await view.render()
  assert.equal(requests.at(-1)?.page, 1)
  await act(async () => view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')[1].click())
  assert.equal(requests.at(-1)?.page, 2)
  await act(async () => [...view.container.querySelectorAll<HTMLTableCellElement>('th')].find((el) => el.textContent === 'Count')!.click())
  assert.equal(requests.at(-1)?.page, 1)
  assert.equal(requests.at(-1)?.sortBy, 'occurrences')
  assert.equal(requests.at(-1)?.sortOrder, 'asc')
})

test('crash navigation reaches report 51 without reloading analytics', async () => {
  const pages: number[] = []
  let statsCalls = 0
  respond((url, params) => {
    if (url.endsWith('/crashes')) {
      pages.push(Number(params.page))
      return { items: [{ id: `report-${params.page}`, created_at: new Date().toISOString(), stacktrace_raw: `trace-${params.page}`, version_code: 1 }], total: 120 }
    }
    if (url.endsWith('/versions')) return []
    if (url.endsWith('/stats')) { statsCalls++; return [] }
    if (url.endsWith('/distributions')) return { models: [], os_versions: [], total: 120 }
    return group
  })
  const view = mount(<AsyncCacheProvider><MemoryRouter initialEntries={['/apps/app/diagnostics/issues/issue?report=50']}>
    <Routes><Route path="/apps/:appId/diagnostics/issues/:issueId" element={<IssueDetailPage />} /></Routes>
  </MemoryRouter></AsyncCacheProvider>)
  // The page reads its role and breadcrumb through outlet context in the real shell.
  const { Outlet } = await import('react-router-dom')
  await view.render(<AsyncCacheProvider><MemoryRouter initialEntries={['/apps/app/diagnostics/issues/issue?report=50']}>
    <Routes><Route element={<Outlet context={{ role: 'admin', setDetail: () => {} }} />}>
      <Route path="/apps/:appId/diagnostics/issues/:issueId" element={<IssueDetailPage />} />
    </Route></Routes>
  </MemoryRouter></AsyncCacheProvider>)
  assert.match(view.container.textContent!, /trace-50/)
  await act(async () => view.container.querySelector<HTMLButtonElement>('[aria-label="Next crash report"]')!.click())
  assert.deepEqual(pages, [50, 51])
  assert.match(view.container.textContent!, /trace-51/)
  assert.equal(statsCalls, 1)
})
