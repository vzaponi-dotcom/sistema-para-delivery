import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'
import { detailResponse } from './comandaFixtures.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
export const nodeText = (node) => typeof node === 'string' ? node : (node.children || []).map(nodeText).join('')
export const buttonNamed = (root, name) => root.findAllByType('button').find((node) => (node.props['aria-label'] || nodeText(node)) === name)

// Browser boundaries only: components, hooks and API clients remain real.
// Render portals inline because react-test-renderer has no DOM portal container.
export async function workspaceHarness(t, { mobile = false } = {}) {
  const media = Object.assign(new EventTarget(), { matches: mobile })
  const storage = new Map([['delivery-print-station-id', 'test-station']])
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const intervals = new Map()
  let intervalId = 0
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => media, localStorage,
    setInterval: (callback, delay) => { const id = ++intervalId; intervals.set(id, { callback, delay }); return id },
    clearInterval: (id) => intervals.delete(id),
    setTimeout, clearTimeout, atob, btoa, scrollY: 0, scrollTo: () => {}, requestAnimationFrame: (fn) => fn(),
  })
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible', body: { style: {} }, querySelectorAll: () => [], activeElement: null,
  })
  const saved = new Map()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path) => {
    if (path === '/api/table-tabs/tab-42') return detailResponse()
    throw new Error(`Unexpected request: ${path}`)
  }
  for (const [key, value] of Object.entries({ window, document, localStorage, navigator: { onLine: true, userAgent: 'test' }, addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-dom'] },
    plugins: [{
      name: 'inline-test-portals', enforce: 'pre',
      resolveId: (id) => id === 'react-dom' ? '\0inline-test-portals' : null,
      load: (id) => id === '\0inline-test-portals' ? 'export const createPortal = (children) => children' : null,
    }],
  })
  const renderers = []
  t.after(async () => {
    for (const renderer of renderers) await act(async () => renderer.unmount())
    await vite.close()
    globalThis.fetch = originalFetch
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return {
    window, document, media, load: (path) => vite.ssrLoadModule(path),
    fireInterval(delay) { for (const interval of [...intervals.values()]) if (interval.delay === delay) interval.callback() },
    setMobile(matches) {
      if (media.matches === matches) return
      media.matches = matches
      media.dispatchEvent(Object.assign(new Event('change'), { matches, media: '(max-width: 820px)' }))
    },
    async render(Component, props = {}, options = {}) {
      let renderer
      await act(async () => { renderer = create(React.createElement(Component, props), options) })
      renderers.push(renderer)
      return renderer
    },
  }
}

export const workspaceTables = [
  { id: 'free', name: 'Varanda', isActive: true, occupancy: 'free', sortOrder: 2, openTableTab: null },
  { id: 'occupied', name: 'Mesa 7', isActive: true, occupancy: 'occupied', sortOrder: 1,
    openTableTab: { id: 'tab-42', number: 42, itemCount: 3, totalCents: 12345 } },
  { id: 'inactive', name: 'Mesa desativada', isActive: false, occupancy: 'free', sortOrder: 3, openTableTab: null },
]
