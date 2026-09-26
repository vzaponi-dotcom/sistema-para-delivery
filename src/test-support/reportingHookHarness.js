import React from 'react'
import { act, create } from 'react-test-renderer'

export async function mountReportingHook(t, useHook, initialProps) {
  let current
  let renderer
  function Probe(props) { current = useHook(props); return null }
  await act(async () => { renderer = create(React.createElement(Probe, initialProps)) })
  t.after(async () => { await act(async () => renderer.unmount()) })
  return {
    current: () => current,
    rerender: async (props) => { await act(async () => renderer.update(React.createElement(Probe, props))) },
  }
}
