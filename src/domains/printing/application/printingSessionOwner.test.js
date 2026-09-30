import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../../../test-support/renderWorkspace.js'
import { usePrintingManager } from './usePrintingManager.js'

test('late queue read and mutation from the expired user cannot repopulate the next session', async (t) => {
  const h = await workspaceHarness(t)
  const previous = globalThis.fetch
  const json = (body) => ({ ok: true, json: async () => body })
  let hold = false, releaseRead, releaseMutation, current
  globalThis.fetch = async (path) => {
    if (String(path).includes('/prioritize')) return new Promise((resolve) => { releaseMutation = () => resolve(json({ job: { id: 'old-mutation' } })) })
    if (String(path).startsWith('/api/printing/jobs?')) return hold ? new Promise((resolve) => { releaseRead = () => resolve(json({ jobs: [{ id: 'old-read' }] })) }) : json({ jobs: [{ id: 'private-a' }] })
    if (path === '/api/printing/stations') return json({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (path === '/api/printing/jobs/summary') return json({ summary: { active: 1 } })
    throw new Error(`Unexpected ${path}`)
  }
  t.after(() => { globalThis.fetch = previous })
  function Probe(props) { current = usePrintingManager(props); return null }
  const renderer = await h.render(Probe, { authenticated: true, accessContextId: 'a' })
  assert.equal(current.jobs[0].id, 'private-a')
  assert.equal(current.activeJobCount, 1)
  hold = true
  let read, mutation
  await act(async () => { read = current.refresh(); mutation = current.requestPrintNow('j', { refreshManager: false }); await Promise.resolve() })
  await act(async () => renderer.update(React.createElement(Probe, { authenticated: false, accessContextId: null })))
  await act(async () => { releaseRead(); releaseMutation(); await read; await mutation })
  assert.deepEqual(current.jobs, [])
  assert.equal(current.activeJobCount, 0)
})

test('expired recovery transition cannot restore the former station or continue recovery', async (t) => {
  const h = await workspaceHarness(t)
  const previous = globalThis.fetch
  const json = (body) => ({ ok: true, json: async () => body })
  let finish, current, mutations = 0
  const station = { id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false, recoveryState: 'pending' }
  globalThis.fetch = async (path) => {
    if (String(path).endsWith('/recovery')) { mutations++; return new Promise((resolve) => { finish = () => resolve(json({ station: { ...station, recoveryState: 'active' } })) }) }
    if (path === '/api/printing/stations') return json({ stations: [station] })
    if (String(path).startsWith('/api/printing/jobs?')) return json({ jobs: [] })
    if (path === '/api/printing/jobs/summary') return json({ summary: {} })
    throw new Error(`Unexpected ${path}`)
  }
  t.after(() => { globalThis.fetch = previous })
  function Probe(props) { current = usePrintingManager(props); return null }
  const renderer = await h.render(Probe, { authenticated: true, accessContextId: 'a' })
  let recovery
  await act(async () => { recovery = current.startRecovery(); await Promise.resolve() })
  await act(async () => renderer.update(React.createElement(Probe, { authenticated: false, accessContextId: null })))
  await act(async () => { finish(); await recovery })
  assert.equal(current.localStation, null)
  assert.equal(mutations, 1)
})
