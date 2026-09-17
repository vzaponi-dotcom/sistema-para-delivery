import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buttonNamed, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const paymentData = () => ({
  methods: [
    { code: 'pix', active: true, sortOrder: 0 },
    { code: 'cash', active: true, sortOrder: 1 },
    { code: 'debit_card', active: true, sortOrder: 2 },
    { code: 'credit_card', active: true, sortOrder: 3 },
    { code: 'transfer', active: true, sortOrder: 4 },
    { code: 'other', active: true, sortOrder: 5 },
  ],
  defaultMethod: 'pix',
})

const resourceState = (data) => ({
  status: 'ready',
  confirmed: { resource: 'paymentMethods', revision: 1, data },
  base: { resource: 'paymentMethods', revision: 1, data },
  draft: structuredClone(data),
  dirty: false,
})

const row = (root, code) => root.findByProps({ 'data-payment-code': code })

test('inactive payment method marks the whole row as visually inactive', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/app/surfaces/settings/PaymentSettings.jsx')
  const data = paymentData()
  data.methods = data.methods.map((method) => method.code === 'cash' ? { ...method, active: false } : method)

  const screen = await h.render(PaymentSettings, {
    resourceState: resourceState(data), readOnly: false,
    onEdit() {}, onSave() {}, onDiscard() {},
  })

  assert.match(row(screen.root, 'cash').props.className, /\bis-inactive\b/)
  assert.doesNotMatch(row(screen.root, 'pix').props.className, /\bis-inactive\b/)
})

test('successful complementary payment menu action closes the menu and restores focus to its summary', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/app/surfaces/settings/PaymentSettings.jsx')
  const edits = []
  function Editor() {
    const [state, setState] = React.useState(resourceState(paymentData()))
    return React.createElement(PaymentSettings, {
      resourceState: state,
      onEdit(draft) {
        edits.push(draft)
        setState((current) => ({ ...current, draft, dirty: true }))
      },
      onSave() {}, onDiscard() {},
    })
  }
  const screen = await h.render(Editor)
  const details = { open: true }
  let focusCount = 0
  const summary = { focus() { focusCount += 1 } }
  details.querySelector = (selector) => selector === 'summary' ? summary : null

  await act(async () => buttonNamed(row(screen.root, 'cash'), 'Definir como padrão').props.onClick({
    currentTarget: { closest: (selector) => selector === 'details' ? details : null },
  }))

  assert.equal(edits.at(-1).defaultMethod, 'cash')
  assert.equal(details.open, false)
  assert.equal(focusCount, 1)
})

test('inactive row styling mutes informational content without disabling the action menu', async () => {
  const css = await readFile(new URL('../../../payment-settings.css', import.meta.url), 'utf8')
  assert.match(css, /\.payment-settings-row\.is-inactive/)
  assert.match(css, /\.payment-settings-row\.is-inactive[\s\S]*payment-method-(?:icon|cell)/)
  assert.match(css, /\.payment-settings-row\.is-inactive[\s\S]*payment-order-cell/)
  assert.doesNotMatch(css, /\.payment-settings-row\.is-inactive\s*\{[^}]*opacity:\s*0(?:\.|;)/s)
})
