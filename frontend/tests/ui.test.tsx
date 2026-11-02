import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React, { act, StrictMode } from 'react'
import { mount } from './dom'
import { Field } from '../src/ui/Field'
import { Input } from '../src/ui/Input'
import { Password } from '../src/ui/Password'
import { Select } from '../src/ui/Select'
import { Button } from '../src/ui/Button'
import { DataList } from '../src/ui/DataList'
import { Loaded } from '../src/app/async'
import { ConfirmDialog } from '../src/ui/ConfirmDialog'
import { Dialog } from '../src/ui/Dialog'
import { Tabs } from '../src/ui/Tabs'
import UiKitPage from '../src/app/pages/UiKitPage'
import { toast, ToastViewport } from '../src/ui/Toast'

function key(el: Element, value: string) {
  el.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  )
}

test('field labels and validation are associated with the actual input', async () => {
  const view = mount(
    <Field label="Workspace" required error="Choose a workspace">
      <Input />
    </Field>,
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

test('Escape closes only the open select before dismissing its parent dialog', async () => {
  let closed = 0
  const view = mount(
    <Dialog
      open
      title="Edit"
      onClose={() => {
        closed++
      }}
    >
      <Select options={[{ label: 'First', value: 1 }]} />
    </Dialog>,
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

test('a filter chip names what it filters and may grow past its trigger', async () => {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains('bnn-select')
      ? new window.DOMRect(40, 80, 90, 24)
      : original.call(this)
  }
  try {
    const view = mount(<Select variant="chip" name="Version" value={1} options={[{ label: '8.4.1', value: 1 }]} />)
    await view.render()
    const trigger = view.container.querySelector<HTMLButtonElement>('[role="combobox"]')!
    assert.equal(trigger.textContent, 'Version8.4.1')
    await act(async () => trigger.click())
    const menu = document.querySelector<HTMLElement>('[role="listbox"]')!
    assert.equal(menu.style.width, '')
    assert.equal(menu.style.minWidth, '90px')
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

test('dialog focuses its input, locks scrolling and restores the trigger', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const view = mount(
    <Dialog open title="Edit workspace" onClose={() => {}}>
      <Input />
    </Dialog>,
  )
  try {
    await view.render()
    assert.equal(document.activeElement, document.querySelector('.bnn-dialog input'))
    assert.equal(document.body.style.overflow, 'hidden')
    assert.equal(document.querySelector('[role="dialog"]')?.getAttribute('aria-modal'), 'true')
    await view.render(<></>)
    assert.equal(document.activeElement, trigger)
    assert.equal(document.body.style.overflow, '')
  } finally {
    trigger.remove()
  }
})

test('opening a previously closed dialog in StrictMode focuses a visible control', async () => {
  const view = mount(
    <StrictMode>
      <Dialog open={false} title="Edit" onClose={() => {}}>
        <input type="file" hidden />
        <Input />
      </Dialog>
    </StrictMode>,
  )
  await view.render()
  await view.render(
    <StrictMode>
      <Dialog open title="Edit" onClose={() => {}}>
        <input type="file" hidden />
        <Input />
      </Dialog>
    </StrictMode>,
  )
  assert.equal(document.activeElement, document.querySelector('.bnn-dialog input:not([hidden])'))
})

test('a confirmation starts on the safe action and cannot be dismissed while working', async () => {
  let closed = 0
  const props = { open: true, title: 'Delete?', onConfirm: () => {}, onClose: () => { closed++ } }
  const view = mount(<ConfirmDialog {...props} confirmLabel="Delete" />)
  await view.render()
  assert.equal((document.activeElement as HTMLElement).textContent, 'Cancel')
  await view.render(<ConfirmDialog {...props} confirmLabel="Delete" loading />)
  await act(async () => key(document.activeElement ?? document.body, 'Escape'))
  await act(async () => {
    document.querySelector('.bnn-overlay')!.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
  })
  assert.equal(closed, 0)
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

test('a loading button keeps its label in the accessibility tree', () => {
  const css = readFileSync('src/ui/Button.css', 'utf8')
  const rule = css.match(/\.is-loading \.bnn-btn__content \{([^}]*)\}/)![1]
  assert.doesNotMatch(rule, /visibility|display/)
})

test('a nested list action keeps its keyboard activation without opening the row', async () => {
  let opened = 0
  const view = mount(<DataList data={[1]} rowKey={(row) => row} onRowClick={() => { opened++ }}
    columns={[{ key: 'download', title: 'Action', render: () => <button type="button">Download</button> }]} />)
  await view.render()
  const button = view.container.querySelector('button')!
  const event = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  await act(async () => { button.dispatchEvent(event) })
  assert.equal(event.defaultPrevented, false)
  assert.equal(opened, 0)
  await act(async () => button.click())
  assert.equal(opened, 0)
  await act(async () => key(view.container.querySelector('tbody tr')!, 'Enter'))
  assert.equal(opened, 1)
  await act(async () => view.container.querySelector<HTMLElement>('tbody td')!.click())
  assert.equal(opened, 2)
})

test('a client-paged list stays in range when its data shrinks', async () => {
  const columns = [{ key: 'id', title: 'Id', render: (row: number) => row }]
  const list = (data: number[]) => <DataList data={data} rowKey={(row) => row} pageSize={2} columns={columns} />
  const view = mount(list([1, 2, 3, 4, 5]))
  await view.render()
  await act(async () => view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')[1].click())
  await act(async () => view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')[1].click())
  assert.equal(view.container.querySelector('tbody td')?.textContent, '5')
  await view.render(list([1, 2]))
  assert.deepEqual([...view.container.querySelectorAll('tbody td')].map((td) => td.textContent), ['1', '2'])
})

test('the selected list row is exposed as current', async () => {
  const view = mount(<DataList data={[1, 2]} rowKey={(row) => row} selectedKey={2} onRowClick={() => {}}
    columns={[{ key: 'id', title: 'Id', render: (row: number) => row }]} />)
  await view.render()
  const rows = view.container.querySelectorAll('tbody tr')
  assert.equal(rows[0].getAttribute('aria-current'), null)
  assert.equal(rows[1].getAttribute('aria-current'), 'true')
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
    remove = toast.success('Saved', { duration: 0 })
  })
  assert.equal(document.querySelectorAll('.bnn-toasts').length, 1)
  assert.equal(document.querySelectorAll('.bnn-toasts [role="status"]').length, 1)
  await act(async () => remove?.())
})

test('a toast action runs once and dismisses the toast', async () => {
  const view = mount(<ToastViewport />)
  await view.render()
  let undone = 0
  await act(async () => {
    toast.success('Resolved', { duration: 0, action: { label: 'Undo', onClick: () => { undone++ } } })
  })
  await act(async () => document.querySelector<HTMLButtonElement>('.bnn-toast__action')!.click())
  assert.equal(undone, 1)
  assert.equal(document.querySelector('.bnn-toast'), null)
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

const tokens = readFileSync('src/ui/tokens.css', 'utf8')
const colors = Object.fromEntries(
  [...tokens.matchAll(/--bnn-([\w-]+):\s*(#[0-9a-f]{6})/g)].map((match) => [match[1], match[2]]),
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
test('text and filled button states meet minimum contrast on every surface they appear on', () => {
  const texts = ['text', 'text-strong', 'text-muted', 'text-faint', 'status-open', 'status-resolved', 'danger']
  const surfaces = ['surface', 'surface-subtle', 'canvas', 'hover', 'selected', 'selected-strong']
  const pairs = [
    ...texts.flatMap((text) => surfaces.map((surface) => [text, surface])),
    ['danger', 'danger-soft'],
    ...['primary', 'primary-hover', 'primary-active', 'danger', 'danger-hover', 'toast-action'].map((tone) => [
      'text-inverse',
      tone,
    ]),
  ]
  for (const [text, background] of pairs)
    assert.ok(
      contrast(text, background) >= 4.5,
      `${text} on ${background}: ${contrast(text, background)}`,
    )
})
test('control boundaries and chart series remain distinguishable on white', () => {
  for (const token of [
    'border-control',
    'status-neutral',
    ...Array.from({ length: 3 }, (_, i) => `chart-${i + 1}`),
  ]) {
    assert.ok(contrast(token, 'surface') >= 3, `${token}: ${contrast(token, 'surface')}`)
  }
})
