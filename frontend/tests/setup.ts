import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  IS_REACT_ACT_ENVIRONMENT: true,
})
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: dom.window.localStorage,
})

dom.window.HTMLElement.prototype.scrollIntoView = function () {}
