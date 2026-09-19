import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'

export async function mountHook(t, useHook, initialProps) {
  let current
  let renderer
  function Probe(props) { current = useHook(props); return null }
  await act(async () => { renderer = create(React.createElement(Probe, initialProps)) })
  t.after(async () => { await act(async () => renderer.unmount()) })
  return {
    current: () => current,
    rerender: async (props) => {
      await act(async () => renderer.update(React.createElement(Probe, props)))
    },
  }
}

export async function createUiHarness(t) {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  t.after(async () => { await server.close() })
  return { load: (path) => server.ssrLoadModule(path) }
}
