import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { mount } from './dom'
import { LineChart } from '../src/ui/LineChart'
import { versionSeries } from '../src/app/series'
import { dayAxis } from '../src/app/format'

const point = { label: 'Today', value: 12 }

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
    const view = mount(<LineChart label="Sessions" series={[]} />)
    await view.render()
    assert.equal(view.container.querySelector('.bnn-chart'), null)
    await view.render(<LineChart label="Sessions" series={[{ label: 'Users', data: [point] }]} />)
    assert.equal(view.container.querySelector('.bnn-chart')?.getAttribute('width'), '320')
  } finally {
    globalThis.ResizeObserver = original
  }
})

test('a chart describes itself and names its lines only when there are several', async () => {
  const view = mount(<LineChart label="Sessions" series={[{ label: 'Users', data: [point] }]} />)
  await view.render()
  assert.equal(view.container.querySelector('svg[role="img"]')?.getAttribute('aria-label'), 'Sessions')
  assert.equal(view.container.querySelector('.bnn-linechart__legend'), null)
  await view.render(<LineChart label="Sessions" series={[{ label: 'Users', data: [point] }, { label: 'Other', dashed: true, data: [point] }]} />)
  assert.match(view.container.querySelector('.bnn-linechart__legend')!.textContent!, /UsersOther/)
})

test('version series name the newest three and add the rest up as Other', () => {
  const day = dayAxis(2)[1]
  const rows = [1, 2, 3, 4, 5].map((code) => ({ date: day, version_code: code, version_name: `v${code}`, count: code * 10 }))
  const series = versionSeries(rows, 2)
  assert.deepEqual(series.map((s) => s.label), ['v5 (5)', 'v4 (4)', 'v3 (3)', 'Other'])
  assert.equal(series[3].dashed, true)
  assert.equal(series[3].data[1].value, 30)
  assert.equal(series[0].data[0].value, 0)
})

test('version series have no Other line when everything is named', () => {
  const day = dayAxis(1)[0]
  const series = versionSeries([{ date: day, version_code: 1, version_name: null, count: 1 }], 1)
  assert.deepEqual(series.map((s) => s.label), ['v1'])
})
