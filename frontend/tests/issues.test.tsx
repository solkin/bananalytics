import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { mount } from './dom'
import api from '../src/api/client'
import { AsyncCacheProvider } from '../src/app/async'
import { CommandsProvider } from '../src/app/commands'
import IssueDetailPage from '../src/app/pages/IssueDetailPage'
import IssuesPage from '../src/app/pages/IssuesPage'
import { parseStackTrace, shortClassName } from '../src/app/stacktrace'

function respond(handler: (url: string, params: Record<string, unknown>, method: string, data: unknown) => unknown) {
  api.defaults.adapter = async (config) => ({
    data: handler(config.url!, config.params ?? {}, config.method ?? 'get', config.data),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}

const group = (id: string, status = 'open') => ({
  id,
  app_id: 'app',
  exception_class: 'java.lang.IllegalStateException',
  exception_message: 'failure',
  first_seen: new Date().toISOString(),
  last_seen: new Date().toISOString(),
  occurrences: 120,
  affected_devices: 1,
  status,
})

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{pathname + search}</output>
}

function page(entry: string, role = 'admin') {
  return (
    <AsyncCacheProvider>
      <CommandsProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route element={<Outlet context={{ role, app: null, reloadApp: () => {}, reloadIssueCount: () => {} }} />}>
              <Route path="/apps/:appId/diagnostics/issues" element={<IssuesPage />}>
                <Route path=":issueId" element={<IssueDetailPage />} />
              </Route>
            </Route>
          </Routes>
          <Where />
        </MemoryRouter>
      </CommandsProvider>
    </AsyncCacheProvider>
  )
}

test('issues request subsequent pages and sort the full dataset on the server', async () => {
  localStorage.clear()
  const requests: Record<string, unknown>[] = []
  respond((url, params) => {
    if (url.endsWith('/crashes')) {
      requests.push({ ...params })
      return { items: [group('a')], total: 125, page: params.page, pageSize: 25 }
    }
    return []
  })
  const view = mount(page('/apps/app/diagnostics/issues'))
  await view.render()
  assert.equal(requests.at(-1)?.page, 1)
  await act(async () => view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')[1].click())
  assert.equal(requests.at(-1)?.page, 2)
  await act(async () => [...view.container.querySelectorAll<HTMLButtonElement>('th button')].find((el) => el.textContent === 'Reports')!.click())
  assert.equal(requests.at(-1)?.page, 1)
  assert.equal(requests.at(-1)?.sortBy, 'occurrences')
  assert.equal(requests.at(-1)?.sortOrder, 'asc')
})

test('crash navigation reaches report 51 without reloading analytics', async () => {
  localStorage.clear()
  const pages: number[] = []
  let statsCalls = 0
  respond((url, params) => {
    if (url.endsWith('/crash-groups/a/crashes')) {
      pages.push(Number(params.page))
      return {
        items: [{ id: `report-${params.page}`, created_at: new Date().toISOString(), stacktrace_raw: `trace-${params.page}`, version_code: 1 }],
        total: 120,
      }
    }
    if (url.endsWith('/crash-groups/a')) return group('a')
    if (url.endsWith('/crash-groups/a/stats')) {
      statsCalls++
      return []
    }
    if (url.endsWith('/distributions')) return { models: [], os_versions: [], total: 120 }
    if (url.endsWith('/apps/app/crashes')) return { items: [group('a')], total: 1 }
    return []
  })
  const view = mount(page('/apps/app/diagnostics/issues/a?report=50'))
  await view.render()
  assert.match(view.container.textContent!, /trace-50/)
  await act(async () => view.container.querySelector<HTMLButtonElement>('[aria-label="Next crash report"]')!.click())
  assert.deepEqual(pages, [50, 51])
  assert.match(view.container.textContent!, /trace-51/)
  assert.equal(statsCalls, 1)
})

function issueApi(statusChanges: unknown[]) {
  respond((url, _params, method, data) => {
    if (url.endsWith('/apps/app/crashes')) return { items: [group('a'), group('b')], total: 2 }
    if (url.match(/\/crash-groups\/[ab]$/)) {
      if (method === 'put') statusChanges.push(JSON.parse(data as string))
      return group(url.endsWith('a') ? 'a' : 'b')
    }
    if (url.endsWith('/distributions')) return { models: [], os_versions: [], total: 0 }
    if (url.endsWith('/crashes')) return { items: [], total: 0 }
    return []
  })
}

test('resolving an issue on the Open tab moves on to the next one', async () => {
  localStorage.clear()
  const changes: unknown[] = []
  issueApi(changes)
  const view = mount(page('/apps/app/diagnostics/issues/a'))
  await view.render()
  const resolve = [...view.container.querySelectorAll('button')].find((b) => b.textContent === 'Resolve')!
  await act(async () => resolve.click())
  assert.deepEqual(changes, [{ status: 'resolved' }])
  assert.match(view.container.querySelector('[data-testid="where"]')!.textContent!, /\/issues\/b\?/)
})

test('a status change keeps the list and the panel on screen while they reload', async () => {
  localStorage.clear()
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let hold = false
  api.defaults.adapter = async (config) => {
    const url = config.url!
    if (hold && config.method === 'get' && url.endsWith('/apps/app/crashes')) await held
    const data = url.endsWith('/apps/app/crashes')
      ? { items: [group('a'), group('b')], total: 2 }
      : url.match(/\/crash-groups\/[ab]$/)
        ? group(url.endsWith('a') ? 'a' : 'b')
        : url.endsWith('/distributions')
          ? { models: [], os_versions: [], total: 0 }
          : url.endsWith('/crashes') ? { items: [], total: 0 } : []
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const view = mount(page('/apps/app/diagnostics/issues/a'))
  await view.render()
  hold = true
  await act(async () => [...view.container.querySelectorAll('button')].find((b) => b.textContent === 'Ignore')!.click())
  assert.equal(view.container.querySelectorAll('tbody tr .iss-row').length, 2)
  assert.equal(view.container.querySelector('.bnn-skeleton'), null)
  await act(async () => release())
})

test('a viewer sees an issue but no way to change it', async () => {
  localStorage.clear()
  issueApi([])
  const view = mount(page('/apps/app/diagnostics/issues/a', 'viewer'))
  await view.render()
  assert.match(view.container.textContent!, /IllegalStateException/)
  const labels = [...view.container.querySelectorAll('button')].map((b) => b.textContent)
  assert.ok(!labels.includes('Resolve'))
  assert.equal(view.container.querySelector('[aria-label="Delete issue"]'), null)
})

test('stack traces separate the app from the framework', () => {
  const lines = parseStackTrace([
    'java.lang.RuntimeException: boom',
    '\tat com.appteka.store.Main.run(Main.kt:1)',
    '\tat android.os.Looper.loop(Looper.java:367)',
    'Caused by: java.io.IOException: down',
    '\tat o.ax.a(SourceFile:17)',
    '\t... 9 more',
  ].join('\n'))
  assert.deepEqual(lines.map((l) => l.kind), ['head', 'app', 'framework', 'head', 'app', 'other'])
})

test('issue names shorten to the class and cope with a missing one', () => {
  assert.equal(shortClassName('android.view.WindowManager$BadTokenException'), 'BadTokenException')
  assert.equal(shortClassName(null), 'Unknown error')
})
