import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'
import { detailResponse } from './comandaFixtures.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
export const nodeText = (node) => typeof node === 'string' ? node : (node.children || []).map(nodeText).join('')
export const buttonNamed = (root, name) => root.findAllByType('button').find((node) => (node.props['aria-label'] || nodeText(node)) === name)

// Browser boundaries only: components, hooks and API clients remain real.
// Render portals inline because react-test-renderer has no DOM portal container.
export async function workspaceHarness(t, { mobile = false, userAgent = 'test' } = {}) {
  const media = Object.assign(new EventTarget(), { matches: mobile })
  const storage = new Map([['delivery-print-station-id', 'test-station']])
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const intervals = new Map()
  const timeouts = new Map()
  const listeners = new Map()
  let intervalId = 0
  let focusCount = 0
  const trackListener = (target, type, listener, adding) => {
    const targetListeners = listeners.get(target) || new Map()
    const eventListeners = targetListeners.get(type) || new Set()
    if (adding) eventListeners.add(listener)
    else eventListeners.delete(listener)
    targetListeners.set(type, eventListeners)
    listeners.set(target, targetListeners)
  }
  const listenerCount = () => [...listeners.values()].reduce((total, targetListeners) => total + [...targetListeners.values()].reduce((count, eventListeners) => count + eventListeners.size, 0), 0)
  const nativeSetTimeout = globalThis.setTimeout
  const nativeClearTimeout = globalThis.clearTimeout
  const setTrackedTimeout = (callback, delay, ...args) => {
    const id = nativeSetTimeout(() => { timeouts.delete(id); callback(...args) }, delay)
    timeouts.set(id, true)
    return id
  }
  const clearTrackedTimeout = (id) => {
    if (timeouts.has(id)) nativeClearTimeout(id)
    timeouts.delete(id)
  }
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => media, localStorage,
    setInterval: (callback, delay) => { const id = ++intervalId; intervals.set(id, { callback, delay }); return id },
    clearInterval: (id) => intervals.delete(id),
    setTimeout: setTrackedTimeout, clearTimeout: clearTrackedTimeout, atob, btoa, scrollY: 0, scrollTo: () => {}, requestAnimationFrame: (fn) => fn(),
  })
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible', body: { style: {} }, documentElement: { style: {} }, querySelectorAll: () => [], activeElement: null,
    createElement: (tagName) => tagName === 'canvas' ? {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '', font: '', textAlign: '', textBaseline: '',
        fillRect() {}, fillText() {},
        getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      }),
    } : {},
  })
  for (const target of [window, document]) {
    const addEventListener = target.addEventListener.bind(target)
    const removeEventListener = target.removeEventListener.bind(target)
    target.addEventListener = (type, listener, options) => { trackListener(target, type, listener, true); addEventListener(type, listener, options) }
    target.removeEventListener = (type, listener, options) => { trackListener(target, type, listener, false); removeEventListener(type, listener, options) }
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path) => {
    if (path === '/api/table-tabs/tab-42') return detailResponse()
    throw new Error(`Unexpected request: ${path}`)
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
  const saved = new Map()
  for (const [key, value] of Object.entries({ window, document, localStorage, navigator: { onLine: true, userAgent }, addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window), setInterval: window.setInterval, clearInterval: window.clearInterval, setTimeout: setTrackedTimeout, clearTimeout: clearTrackedTimeout })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
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
    fireAllIntervals() { for (const interval of [...intervals.values()]) interval.callback() },
    setVisibility(visibilityState) { document.visibilityState = visibilityState },
    recordFocus() { focusCount += 1 },
    activitySnapshot({ ignoreFocus = false } = {}) {
      const snapshot = { listeners: listenerCount(), timers: intervals.size + timeouts.size }
      if (!ignoreFocus) snapshot.focus = focusCount
      return snapshot
    },
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
