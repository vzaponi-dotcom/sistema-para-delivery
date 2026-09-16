import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { SUCCESS_DISMISS_MS, TOAST_DISMISS_MS, useFeedbackRuntime } from './useFeedbackRuntime.js'

function createHarness() {
  let current
  const Harness = () => {
    current = useFeedbackRuntime()
    return null
  }
  return { Harness, getCurrent: () => current }
}

test('feedback runtime preserves toast/success copy and dismiss timings', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  let renderer
  await act(async () => { renderer = create(React.createElement(harness.Harness)) })
  t.after(() => renderer.unmount())

  assert.equal(TOAST_DISMISS_MS, 2600)
  assert.equal(SUCCESS_DISMISS_MS, 1800)

  await act(async () => { harness.getCurrent().setToastMessage('Atenção') })
  assert.equal(harness.getCurrent().toastMessage, 'Atenção')
  await act(async () => { t.mock.timers.tick(2599) })
  assert.equal(harness.getCurrent().toastMessage, 'Atenção')
  await act(async () => { t.mock.timers.tick(1) })
  assert.equal(harness.getCurrent().toastMessage, '')

  await act(async () => { harness.getCurrent().showSuccessMessage() })
  assert.equal(harness.getCurrent().successMessage, 'Ação salva com sucesso')
  await act(async () => { t.mock.timers.tick(1799) })
  assert.equal(harness.getCurrent().successMessage, 'Ação salva com sucesso')
  await act(async () => { t.mock.timers.tick(1) })
  assert.equal(harness.getCurrent().successMessage, '')
})
