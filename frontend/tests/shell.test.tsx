import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { mount } from './dom'
import App from '../src/App'
import api from '../src/api/client'
import { CommandsProvider, useRegisterCommands } from '../src/app/commands'
import { canOpen, navForRole, startPath } from '../src/app/nav'
import { CommandPalette } from '../src/ui/CommandPalette'

function press(key: string, target: Element | Document = document, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

function Registered({ run }: { run: (id: string) => void }) {
  useRegisterCommands(() => [
    { id: 'resolve', group: 'Issue', label: 'Resolve issue', keys: ['R'], run: () => run('resolve') },
    { id: 'overview', group: 'Go to', label: 'Overview', keys: ['G', 'O'], run: () => run('overview') },
  ], [run])
  return <input aria-label="Search" />
}

test('single keys and sequences run their command, but not while typing', async () => {
  const ran: string[] = []
  const run = (id: string) => { ran.push(id) }
  const view = mount(<CommandsProvider><Registered run={run} /></CommandsProvider>)
  await view.render()
  await act(async () => press('r'))
  await act(async () => { press('g'); press('o') })
  assert.deepEqual(ran, ['resolve', 'overview'])
  await act(async () => press('r', view.container.querySelector('input')!))
  assert.deepEqual(ran, ['resolve', 'overview'])
  await act(async () => { press('g'); press('x'); press('o') })
  assert.deepEqual(ran, ['resolve', 'overview'])
})

test('a shortcut does not fire behind an open dialog or palette', async () => {
  const ran: string[] = []
  const run = (id: string) => { ran.push(id) }
  const view = mount(<CommandsProvider><Registered run={run} /></CommandsProvider>)
  await view.render()
  await act(async () => press('k', document, { metaKey: true }))
  assert.ok(document.querySelector('[role="dialog"]'))
  await act(async () => press('r', document.body))
  assert.deepEqual(ran, [])
  await act(async () => press('k', document, { ctrlKey: true }))
  assert.equal(document.querySelector('[role="dialog"]'), null)
})

test('the palette does not open on a screen without commands', async () => {
  const view = mount(<CommandsProvider><span>Sign in</span></CommandsProvider>)
  await view.render()
  await act(async () => press('k', document, { metaKey: true }))
  assert.equal(document.querySelector('[role="dialog"]'), null)
})

test('the palette filters, walks with arrows in display order and runs with Enter', async () => {
  const ran: string[] = []
  const commands = [
    { id: 'a', group: 'One', label: 'Alpha', run: () => ran.push('a') },
    { id: 'b', group: 'Two', label: 'Beta', run: () => ran.push('b') },
    { id: 'c', group: 'One', label: 'Gamma', run: () => ran.push('c') },
  ]
  let closed = 0
  const view = mount(<CommandPalette open commands={commands} onClose={() => { closed++ }} />)
  await view.render()
  const input = document.querySelector<HTMLInputElement>('.bnn-palette input')!
  assert.equal(document.activeElement, input)
  const labels = () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent)
  assert.deepEqual(labels(), ['Alpha', 'Gamma', 'Beta'])
  await act(async () => press('ArrowDown', input))
  assert.equal(document.querySelector('[aria-selected="true"]')?.textContent, 'Gamma')
  await act(async () => press('Enter', input))
  assert.deepEqual(ran, ['c'])
  assert.equal(closed, 1)
})

test('the palette reports when nothing matches and Enter does nothing', async () => {
  let ran = 0
  const view = mount(<CommandPalette open commands={[{ id: 'a', group: 'One', label: 'Alpha', run: () => { ran++ } }]} onClose={() => {}} />)
  await view.render()
  const input = document.querySelector<HTMLInputElement>('.bnn-palette input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'zzz')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  assert.match(document.querySelector('.bnn-palette__list')!.textContent!, /No matching commands/)
  await act(async () => press('Enter', input))
  assert.equal(ran, 0)
})

test('roles see only what they may open', () => {
  assert.deepEqual(navForRole('tester').map((g) => g.label), ['Distribution'])
  assert.ok(!navForRole('viewer').some((g) => g.label === 'Settings'))
  assert.equal(startPath('tester'), 'distribution/releases')
  assert.equal(canOpen('tester', 'analytics/overview'), false)
  assert.equal(canOpen('viewer', 'settings/general'), false)
  assert.equal(canOpen('viewer', 'analytics/overview'), true)
  assert.equal(canOpen('admin', 'settings/people'), true)
})

function Where() {
  const { pathname, state } = useLocation()
  return <output data-testid="where" data-from={(state as { from?: { pathname: string } } | null)?.from?.pathname}>{pathname}</output>
}

test('a signed-out visitor lands on sign-in and remembers the page they wanted', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url?.includes('me')) throw new Error('Not signed in')
    return { data: { registration_enabled: true }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const view = mount(<MemoryRouter initialEntries={['/apps/app/diagnostics/issues']}><App /><Where /></MemoryRouter>)
  await view.render()
  await act(async () => {})
  const where = view.container.querySelector('[data-testid="where"]')!
  assert.equal(where.textContent, '/login')
  assert.equal(where.getAttribute('data-from'), '/apps/app/diagnostics/issues')
  assert.match(view.container.textContent!, /Sign in to Bananalytics/)
  assert.match(view.container.textContent!, /Sign up/)
})

test('the app stays usable when the config request fails', async () => {
  api.defaults.adapter = async () => { throw new Error('Server is down') }
  const view = mount(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
  await view.render()
  await act(async () => {})
  assert.match(view.container.textContent!, /Sign in to Bananalytics/)
  assert.doesNotMatch(view.container.textContent!, /Sign up/)
})
