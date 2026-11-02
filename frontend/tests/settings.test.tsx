import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { mount } from './dom'
import api from '../src/api/client'
import { CommandsProvider } from '../src/app/commands'
import ApiKeysPage from '../src/app/pages/ApiKeysPage'
import PeoplePage from '../src/app/pages/PeoplePage'
import { AuthProvider } from '../src/context/AuthContext'

const me = { id: 'u1', email: 'me@example.com', name: 'Me', avatar_url: null, created_at: '2026-01-01T00:00:00Z' }
const member = (over: object) => ({
  id: 'a1', app_id: 'app', user_id: 'u1', user_email: 'me@example.com', user_name: 'Me', user_avatar_url: null,
  role: 'admin', status: 'active', created_at: '2026-01-01T00:00:00Z', ...over,
})
const key = (over: object) => ({
  id: 'k1', app_id: 'app', name: 'Production', scope: 'sdk', key_prefix: 'bnn_abcd', created_by: 'Me',
  last_used_at: null, revoked_at: null, created_at: '2026-01-01T00:00:00Z', ...over,
})

function respond(handler: (url: string, method: string) => unknown, calls: string[] = []) {
  api.defaults.adapter = async (config) => {
    const method = config.method ?? 'get'
    if (method !== 'get') calls.push(`${method} ${config.url}`)
    const url = config.url!
    const data = url === '/auth/me' ? { user: me } : url === '/auth/config' ? { registration_enabled: true, smtp_configured: true } : handler(url, method)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
}

function page(path: string, element: React.ReactNode) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CommandsProvider>
          <Routes>
            <Route element={<Outlet context={{ role: 'admin', app: null, reloadApp: () => {}, reloadIssueCount: () => {} }} />}>
              <Route path="/apps/:appId/*" element={element} />
            </Route>
          </Routes>
        </CommandsProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

const button = (root: ParentNode, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === text)!

test('revoking a key asks first and warns while no SDK key stays active', async () => {
  const calls: string[] = []
  let revoked = false
  respond((url) => (url.endsWith('/keys') ? [key({ revoked_at: revoked ? '2026-02-01T00:00:00Z' : null })] : {}), calls)
  const view = mount(page('/apps/app/settings/api-keys', <ApiKeysPage />))
  await view.render()
  assert.equal(view.container.querySelector('[role="alert"]'), null)
  await act(async () => view.container.querySelector<HTMLElement>('tbody td')!.click())
  await act(async () => button(view.container, 'Revoke').click())
  assert.deepEqual(calls, [])
  const dialog = document.querySelector('[role="dialog"]')!
  revoked = true
  await act(async () => button(dialog, 'Revoke').click())
  assert.deepEqual(calls, ['post /apps/app/keys/k1/revoke'])
  assert.match(view.container.querySelector('[role="alert"]')!.textContent!, /no active SDK API keys/)
})

test('you cannot change your own membership', async () => {
  respond((url) => (url.endsWith('/access') ? [member({})] : {}))
  const view = mount(page('/apps/app/settings/people', <PeoplePage />))
  await view.render()
  assert.ok(button(view.container, 'Invite people'))
  await act(async () => view.container.querySelector<HTMLElement>('tbody td')!.click())
  assert.match(view.container.textContent!, /Member/)
  assert.equal(button(view.container, 'Revoke'), undefined)
  assert.equal(view.container.querySelector('[role="combobox"]'), null)
})

test('a viewer cannot invite people', async () => {
  respond((url) => (url.endsWith('/access') ? [member({ role: 'viewer' })] : {}))
  const view = mount(page('/apps/app/settings/people', <PeoplePage />))
  await view.render()
  assert.equal(button(view.container, 'Invite people'), undefined)
})

test('an invited person can be cancelled only through a confirmation', async () => {
  const calls: string[] = []
  respond((url) => (url.endsWith('/access') ? [member({}), member({ id: 'a2', user_id: null, user_name: null, user_email: 'new@example.com', role: 'tester', status: 'invited' })] : {}), calls)
  const view = mount(page('/apps/app/settings/people', <PeoplePage />))
  await view.render()
  await act(async () => view.container.querySelectorAll<HTMLElement>('tbody tr')[1].querySelector('td')!.click())
  assert.ok(button(view.container, 'Copy invitation link'))
  await act(async () => button(view.container, 'Cancel').click())
  assert.deepEqual(calls, [])
  await act(async () => button(document.querySelector('[role="dialog"]')!, 'Cancel invitation').click())
  assert.deepEqual(calls, ['delete /apps/app/access/a2'])
})
