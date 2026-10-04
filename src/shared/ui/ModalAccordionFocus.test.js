import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('modal traps both Tab directions across visible summaries and excludes closed accordion buttons', async t => {
  const h = await workspaceHarness(t)
  const { default: Modal } = await h.load('/src/shared/ui/Modal.jsx')
  const control = (name, visible = true) => ({ name, getClientRects: () => visible ? [{}] : [], focus() { if (visible) h.document.activeElement = this } })
  const close = control('close'), summary = control('printing summary'), hiddenPrint = control('hidden print', false)
  // Chromium reports layout rectangles even for descendants of closed details.
  hiddenPrint.getClientRects = () => [{}]
  const accordion = { tagName: 'DETAILS', open: false, querySelector: () => ({ contains: node => node === summary }) }
  summary.parentElement = accordion
  hiddenPrint.parentElement = accordion
  const host = { querySelectorAll: selector => selector.includes('summary') ? [close, summary, hiddenPrint] : [close, hiddenPrint] }
  h.document.querySelectorAll = () => [host]
  await h.render(Modal, { title: 'Test', onClose() {}, children: React.createElement('details', null, React.createElement('summary', null, 'Impressão'), React.createElement('button', null, 'Imprimir')) }, { createNodeMock: element => element.props.role === 'dialog' ? host : null })
  const key = shiftKey => { const event = new Event('keydown', { cancelable: true }); Object.defineProperties(event, { key: { value: 'Tab' }, shiftKey: { value: shiftKey } }); h.document.dispatchEvent(event); return event }
  h.document.activeElement = close
  assert.equal(key(true).defaultPrevented, true)
  assert.equal(h.document.activeElement, summary)
  assert.equal(key(false).defaultPrevented, true)
  assert.equal(h.document.activeElement, close)
})
