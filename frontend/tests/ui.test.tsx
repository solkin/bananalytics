import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React, { act, StrictMode } from 'react'
import { mount } from './dom'
import { FormItem, Input, Password } from '../src/ui/forms'
import { Select } from '../src/ui/Select'
import { Button } from '../src/ui/primitives'
import { AreaChart } from '../src/ui/charts'
import { Table } from '../src/ui/Table'
import { Loaded } from '../src/next/async'
import { Dropdown, Modal, Tabs } from '../src/ui/overlays'
import UiKitPage from '../src/pages/UiKitPage'
import { toast, ToastViewport } from '../src/ui/toast'

function key(el: Element, value: string) {
  el.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  )
}

test('field labels and validation are associated with the actual input', async () => {
  const view = mount(
    <FormItem label="Workspace" required error="Choose a workspace">
      <Input />
    </FormItem>,
  )
  await view.render()
  const input = view.container.querySelector('input')!
  const label = view.container.querySelector('label')!
  assert.equal(label.htmlFor, input.id)
  assert.ok(input.id)
  assert.equal(input.getAttribute('aria-invalid'), 'true')
  assert.equal(
    document.getElementById(input.getAttribute('aria-describedby')!)?.textContent,
    'Choose a workspace',
  )
})

test('password visibility is keyboard accessible without submitting a form', async () => {
  const view = mount(<Password defaultValue="example" />)
  await view.render()
  const button = view.container.querySelector('button')!
  assert.notEqual(button.tabIndex, -1)
  assert.equal(button.type, 'button')
  await act(async () => button.click())
  assert.equal(view.container.querySelector('input')!.type, 'text')
  assert.equal(button.getAttribute('aria-pressed'), 'true')
})

test('select skips disabled options, commits from the keyboard and clears', async () => {
  const changes: Array<string | number> = []
  const options = [
    { label: 'First', value: 1 },
    { label: 'Unavailable', value: 2, disabled: true },
    { label: 'Third', value: 3 },
  ]
  const view = mount(
    <Select
      aria-label="Version"
      options={options}
      value={1}
      allowClear
      onChange={(v) => changes.push(v)}
    />,
  )
  await view.render()
  const trigger = view.container.querySelector('[role="combobox"]')!
  await act(async () => key(trigger, 'ArrowDown'))
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  await act(async () => key(trigger, 'ArrowDown'))
  await act(async () => key(trigger, 'Enter'))
  assert.deepEqual(changes, [3])
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  await act(async () =>
    view.container.querySelector<HTMLButtonElement>('[aria-label="Clear"]')!.click(),
  )
  assert.deepEqual(changes, [3, ''])
})

test('Escape closes only the open select before dismissing its parent modal', async () => {
  let closed = 0
  const view = mount(
    <Modal
      open
      title="Edit"
      onClose={() => {
        closed++
      }}
    >
      <Select options={[{ label: 'First', value: 1 }]} />
    </Modal>,
  )
  await view.render()
  const trigger = document.querySelector('[role="combobox"]')!
  await act(async () => key(trigger, 'ArrowDown'))
  await act(async () => key(trigger, 'Escape'))
  assert.equal(closed, 0)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  await act(async () => key(trigger, 'Escape'))
  assert.equal(closed, 1)
})

test('a select popup matches the width of its trigger outside the form container', async () => {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains('bnn-select')
      ? new window.DOMRect(40, 80, 240, 34)
      : original.call(this)
  }
  try {
    const view = mount(<Select options={[{ label: 'A release with a long version name', value: 1 }]} />)
    await view.render()
    const trigger = view.container.querySelector<HTMLButtonElement>('[role="combobox"]')!
    await act(async () => trigger.click())
    const menu = document.querySelector<HTMLElement>('[role="listbox"]')!
    assert.equal(view.container.contains(menu), false)
    assert.equal(window.getComputedStyle(menu).width, '240px')
  } finally {
    HTMLElement.prototype.getBoundingClientRect = original
  }
})

test('tabs expose the selected panel and move focus with arrow keys', async () => {
  const view = mount(
    <Tabs
      items={[
        { key: 'one', label: 'One', children: 'First panel' },
        { key: 'two', label: 'Two', children: 'Second panel' },
      ]}
    />,
  )
  await view.render()
  const tabs = view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  await act(async () => key(tabs[0], 'ArrowRight'))
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true')
  assert.equal(document.activeElement, tabs[1])
  const panel = view.container.querySelector('[role="tabpanel"]')!
  assert.equal(panel.textContent, 'Second panel')
  assert.equal(panel.getAttribute('aria-labelledby'), tabs[1].id)
})

test('modal focuses its input, locks scrolling and restores the trigger', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const view = mount(
    <Modal open title="Edit workspace" onClose={() => {}}>
      <Input />
    </Modal>,
  )
  try {
    await view.render()
    assert.equal(document.activeElement, document.querySelector('.bnn-modal input'))
    assert.equal(document.body.style.overflow, 'hidden')
    assert.equal(document.querySelector('[role="dialog"]')?.getAttribute('aria-modal'), 'true')
    await view.render(<></>)
    assert.equal(document.activeElement, trigger)
    assert.equal(document.body.style.overflow, '')
  } finally {
    trigger.remove()
  }
})

test('opening a previously closed modal in StrictMode focuses a visible control', async () => {
  const view = mount(
    <StrictMode>
      <Modal open={false} title="Edit" onClose={() => {}}>
        <input type="file" hidden />
        <Input />
      </Modal>
    </StrictMode>,
  )
  await view.render()
  await view.render(
    <StrictMode>
      <Modal open title="Edit" onClose={() => {}}>
        <input type="file" hidden />
        <Input />
      </Modal>
    </StrictMode>,
  )
  assert.equal(document.activeElement, document.querySelector('.bnn-modal input:not([hidden])'))
})

test('dropdown moves focus into its menu in StrictMode and Escape closes it', async () => {
  const view = mount(
    <StrictMode>
      <Dropdown label="Account" items={[{ key: 'profile', label: 'Profile' }]}>
        <span>Account</span>
      </Dropdown>
    </StrictMode>,
  )
  await view.render()
  const trigger = view.container.querySelector<HTMLElement>('[role="button"]')!
  await act(async () => trigger.click())
  const item = document.querySelector('[role="menuitem"]')!
  assert.equal(document.activeElement, item)
  await act(async () => key(item, 'Escape'))
  assert.equal(document.querySelector('[role="menu"]'), null)
})

test('loading buttons retain their label and do not submit by default', async () => {
  const view = mount(<Button loading>Save changes</Button>)
  await view.render()
  const button = view.container.querySelector('button')!
  assert.equal(button.textContent, 'Save changes')
  assert.equal(button.type, 'button')
  assert.equal(button.getAttribute('aria-busy'), 'true')
  assert.equal(button.disabled, true)
})

test('a nested table action keeps its keyboard activation without opening the row', async () => {
  let opened = 0
  const view = mount(<Table data={[1]} rowKey={(row) => row} onRowClick={() => { opened++ }}
    columns={[{ key: 'download', title: 'Action', render: () => <button type="button">Download</button> }]} />)
  await view.render()
  const button = view.container.querySelector('button')!
  const event = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  await act(async () => { button.dispatchEvent(event) })
  assert.equal(event.defaultPrevented, false)
  assert.equal(opened, 0)
  await act(async () => key(view.container.querySelector('tbody tr')!, 'Enter'))
  assert.equal(opened, 1)
})

test('one toast viewport displays exactly one notification', async () => {
  const view = mount(
    <>
      <UiKitPage />
      <ToastViewport />
    </>,
  )
  await view.render()
  let remove: (() => void) | undefined
  await act(async () => {
    remove = toast.success('Saved', 0)
  })
  assert.equal(document.querySelectorAll('[role="status"]').length, 1)
  await act(async () => remove?.())
})

test('a loading boundary retains the measured height of its previous content', async () => {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { ...original.call(this), height: 240 } as DOMRect
  }
  try {
    const view = mount(<Loaded preserveHeight state={{ data: 'Report', loading: false, error: null }}>{(data) => <p>{data}</p>}</Loaded>)
    await view.render()
    await view.render(<Loaded preserveHeight state={{ data: null, loading: true, error: null }}>{() => <p>Report</p>}</Loaded>)
    assert.equal(view.container.firstElementChild?.getAttribute('style'), 'min-height: 240px;')
  } finally {
    HTMLElement.prototype.getBoundingClientRect = original
  }
})

test('a chart measures its container after transitioning from empty to populated', async () => {
  const original = globalThis.ResizeObserver
  class MeasuredObserver implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe() {
      this.callback([{ contentRect: { width: 320 } } as ResizeObserverEntry], this)
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MeasuredObserver
  try {
    const view = mount(<AreaChart data={[]} />)
    await view.render()
    assert.equal(view.container.querySelector('.bnn-chart'), null)
    await view.render(<AreaChart data={[{ label: 'Today', value: 12 }]} />)
    assert.equal(view.container.querySelector('.bnn-chart')?.getAttribute('width'), '320')
  } finally {
    globalThis.ResizeObserver = original
  }
})

const theme = readFileSync('src/ui/theme.css', 'utf8')
const colors = Object.fromEntries(
  [...theme.matchAll(/--bnn-([\w-]+):\s*(#[0-9a-f]{6})/g)].map((match) => [match[1], match[2]]),
)
function luminance(hex: string) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
}
function contrast(a: string, b: string) {
  const [dark, light] = [luminance(colors[a]), luminance(colors[b])].sort((x, y) => x - y)
  return (light + 0.05) / (dark + 0.05)
}
test('text, semantic tags and filled button states meet minimum contrast', () => {
  const pairs = [
    ['text-tertiary', 'surface'],
    ['text-tertiary', 'bg'],
    ...['primary', 'success', 'warning', 'danger', 'purple'].map((tone) => [
      `${tone}-strong`,
      `${tone}-soft`,
    ]),
    ...[
      'primary',
      'primary-hover',
      'primary-active',
      'danger',
      'danger-hover',
      'danger-active',
    ].map((tone) => ['text-inverse', tone]),
  ]
  for (const [text, background] of pairs)
    assert.ok(
      contrast(text, background) >= 4.5,
      `${text} on ${background}: ${contrast(text, background)}`,
    )
})
test('control boundaries and chart series remain distinguishable on white', () => {
  for (const token of [
    'control-border',
    'icon-muted',
    ...Array.from({ length: 8 }, (_, i) => `chart-${i + 1}`),
  ]) {
    assert.ok(contrast(token, 'surface') >= 3, `${token}: ${contrast(token, 'surface')}`)
  }
})
