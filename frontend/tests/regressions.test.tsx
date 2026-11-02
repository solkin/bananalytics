import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { mount } from './dom'
import { AsyncCacheProvider, useAsync } from '../src/app/async'
import { DataList } from '../src/ui/DataList'

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

test('controlled list sorting and pagination are delegated to the server', async () => {
  const changes: string[] = []
  const view = mount(<DataList columns={[{ key: 'count', title: 'Count', sorter: true, render: (r: number) => r }]}
    data={[9, 1]} rowKey={(r) => r}
    pagination={{ page: 1, pageSize: 2, total: 120, onChange: (page) => changes.push(`page:${page}`) }}
    sort={{ key: 'count', direction: 'desc', onChange: (key, direction) => changes.push(`${key}:${direction}`) }} />)
  await view.render()
  await act(async () => view.container.querySelector<HTMLButtonElement>('th button')!.click())
  const buttons = view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')
  await act(async () => buttons[1].click())
  assert.deepEqual(changes, ['count:asc', 'page:2'])
  assert.deepEqual([...view.container.querySelectorAll('tbody td')].map((td) => td.textContent), ['9', '1'])
  assert.match(view.container.textContent!, /of 120/)
})

test('client sorting returns to the first page', async () => {
  const data = [3, 1, 2]
  const view = mount(<DataList columns={[{ key: 'value', title: 'Value', sorter: (a: number, b: number) => a - b, render: (r: number) => r }]}
    data={data} rowKey={(r) => r} pageSize={2} />)
  await view.render()
  await act(async () => view.container.querySelectorAll<HTMLButtonElement>('.bnn-pagination__btn')[1].click())
  assert.deepEqual([...view.container.querySelectorAll('tbody td')].map((td) => td.textContent), ['2'])
  await act(async () => view.container.querySelector<HTMLButtonElement>('th button')!.click())
  assert.deepEqual([...view.container.querySelectorAll('tbody td')].map((td) => td.textContent), ['1', '2'])
})
