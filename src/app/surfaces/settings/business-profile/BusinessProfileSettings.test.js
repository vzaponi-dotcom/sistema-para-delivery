import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buttonNamed, nodeText, workspaceHarness } from '../../../../test-support/renderWorkspace.js'

const data = (overrides = {}) => ({
  name: 'Amor & Sabor',
  phone: '(19) 99999-9999',
  address: {
    line: 'Rua das Flores',
    number: '123',
    complement: '',
    neighborhood: 'Centro',
    city: 'Monte Mor',
    state: 'SP',
    postalCode: '13190000',
  },
  logo: { present: true, version: 'server-v3' },
  logoAction: 'keep',
  ...overrides,
})

const resourceState = (overrides = {}) => ({
  status: 'ready',
  confirmed: { revision: 3, data: data(), meta: {} },
  base: { revision: 3, data: data(), meta: {} },
  draft: data(),
  dirty: false,
  error: null,
  ...overrides,
})

async function renderEditor(t, options = {}) {
  const h = await workspaceHarness(t)
  const { default: BusinessProfileSettings } = await h.load('/src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx')
  const edits = []
  const saves = []
  const discards = []
  const previewEvents = []
  const normalizedBlob = new Blob(['normalized-logo'], { type: 'image/webp' })
  let sequence = 0

  function Editor() {
    const [state, setState] = React.useState(options.initialState || resourceState())
    return React.createElement(BusinessProfileSettings, {
      resourceState: state,
      readOnly: options.readOnly || false,
      normalizeLogo: options.normalizeLogo || (async () => ({
        blob: normalizedBlob,
        sha256: 'a'.repeat(64),
        width: 512,
        height: 256,
        sizeBytes: normalizedBlob.size,
        contentType: 'image/webp',
      })),
      previewOwnerFactory: () => ({
        replace() {
          const url = `blob:business-logo-${++sequence}`
          previewEvents.push(['replace', url])
          return url
        },
        clear() { previewEvents.push(['clear']) },
        dispose() { previewEvents.push(['dispose']) },
        current() { return sequence ? `blob:business-logo-${sequence}` : null },
      }),
      onEdit: (draft) => {
        edits.push(draft)
        setState((current) => ({ ...current, draft, dirty: JSON.stringify(draft) !== JSON.stringify(current.base?.data) }))
      },
      onSave: async (transient) => {
        saves.push(transient)
        return options.saveResult ?? true
      },
      onDiscard: () => {
        discards.push(true)
        setState((current) => ({ ...current, draft: current.confirmed.data, base: current.confirmed, dirty: false }))
        return true
      },
      onReconcile() {},
      onReload() {},
      onReviewConflict() {},
      onNavigateHome() {},
    })
  }

  const screen = await h.render(Editor)
  return { h, screen, edits, saves, discards, previewEvents, normalizedBlob }
}

test('renders identity, contact, address and preview using the confirmed logo without version footer', async (t) => {
  const { screen } = await renderEditor(t)
  const text = nodeText(screen.root)
  assert.match(text, /Identidade da operação/)
  assert.match(text, /Identidade/)
  assert.match(text, /Contato/)
  assert.match(text, /Endereço/)
  assert.match(text, /Prévia/)
  assert.match(text, /Logo da operação/)
  assert.doesNotMatch(text, /Versão/)

  const image = screen.root.findByProps({ alt: 'Logo da operação' })
  assert.equal(image.props.src, '/api/business/logo?v=server-v3')
  assert.equal(screen.root.findByProps({ name: 'name' }).props.value, 'Amor & Sabor')
  assert.equal(screen.root.findByProps({ name: 'phone' }).props.value, '(19) 99999-9999')
  assert.equal(screen.root.findByProps({ name: 'address.city' }).props.value, 'Monte Mor')
})

test('selecting a logo only changes the draft/preview and save receives the ephemeral normalized Blob', async (t) => {
  const { screen, edits, saves, normalizedBlob, previewEvents } = await renderEditor(t)
  const file = new Blob(['source-png'], { type: 'image/png' })

  const input = screen.root.findByProps({ type: 'file' })
  await act(async () => input.props.onChange({ target: { files: [file], value: 'logo.png' } }))

  assert.equal(saves.length, 0, 'file selection must not upload')
  assert.equal(edits.at(-1).logoAction, 'replace')
  assert.deepEqual(edits.at(-1).logo, { present: true, version: `local:${'a'.repeat(64)}` })
  assert.equal(screen.root.findByProps({ alt: 'Logo da operação' }).props.src, 'blob:business-logo-1')
  assert.deepEqual(previewEvents[0], ['replace', 'blob:business-logo-1'])

  await act(async () => assert.equal(await buttonNamed(screen.root, 'Salvar alterações').props.onClick(), true))
  assert.equal(saves.length, 1)
  assert.equal(saves[0].logoBlob, normalizedBlob)
})

test('replace, remove and cancel keep logo lifecycle local until explicit save', async (t) => {
  const { screen, edits, saves, discards, previewEvents } = await renderEditor(t)
  const input = screen.root.findByProps({ type: 'file' })
  await act(async () => input.props.onChange({ target: { files: [new Blob(['first'], { type: 'image/jpeg' })] } }))
  await act(async () => input.props.onChange({ target: { files: [new Blob(['second'], { type: 'image/webp' })] }))

  assert.equal(saves.length, 0)
  assert.equal(edits.at(-1).logoAction, 'replace')

  await act(async () => buttonNamed(screen.root, 'Remover logo').props.onClick())
  assert.equal(edits.at(-1).logoAction, 'remove')
  assert.deepEqual(edits.at(-1).logo, { present: false, version: null })
  assert.equal(screen.root.findAllByProps({ alt: 'Logo da operação' }).length, 0)

  await act(async () => buttonNamed(screen.root, 'Cancelar').props.onClick())
  assert.equal(discards.length, 1)
  assert.equal(saves.length, 0)
  assert.equal(previewEvents.some(([event]) => event === 'clear'), true)
})

test('name is required locally and contact/address edits update only the draft', async (t) => {
  const { screen, edits, saves } = await renderEditor(t)

  await act(async () => screen.root.findByProps({ name: 'phone' }).props.onChange({ target: { value: '(19) 98888-7777' } }))
  assert.equal(edits.at(-1).phone, '(19) 98888-7777')
  assert.equal(saves.length, 0)

  await act(async () => screen.root.findByProps({ name: 'address.line' }).props.onChange({ target: { value: 'Av. Brasil' } }))
  assert.equal(edits.at(-1).address.line, 'Av. Brasil')

  await act(async () => screen.root.findByProps({ name: 'name' }).props.onChange({ target: { value: '   ' } }))
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(saves.length, 0)
  assert.match(nodeText(screen.root), /Informe o nome da operação/)
})

test('read-only and controller states stay distinguishable without exposing mutation controls', async (t) => {
  const h = await workspaceHarness(t)
  const { default: BusinessProfileSettings } = await h.load('/src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx')
  const noop = () => {}

  for (const [status, expected] of [
    ['loading', 'Carregando configurações'],
    ['saving', 'Salvando alterações'],
    ['unconfirmed', 'resultado do salvamento'],
    ['conflict', 'alterações concorrentes'],
  ]) {
    const state = resourceState({ status, dirty: status !== 'loading' })
    const screen = await h.render(BusinessProfileSettings, {
      resourceState: state,
      onEdit: noop,
      onSave: noop,
      onDiscard: noop,
      onReconcile: noop,
      onReload: noop,
      onReviewConflict: noop,
      onNavigateHome: noop,
    })
    assert.match(nodeText(screen.root), new RegExp(expected, 'i'))
    await act(async () => screen.unmount())
  }

  const error = await h.render(BusinessProfileSettings, {
    resourceState: { status: 'error', confirmed: null, draft: null, dirty: false, error: 'Falha controlada' },
    onEdit: noop, onSave: noop, onDiscard: noop, onReconcile: noop, onReload: noop, onReviewConflict: noop, onNavigateHome: noop,
  })
  assert.match(nodeText(error.root), /Falha controlada/)
  await act(async () => error.unmount())

  const readOnly = await h.render(BusinessProfileSettings, {
    resourceState: resourceState(),
    readOnly: true,
    onEdit: noop, onSave: noop, onDiscard: noop, onReconcile: noop, onReload: noop, onReviewConflict: noop, onNavigateHome: noop,
  })
  assert.match(nodeText(readOnly.root), /Somente leitura/)
  assert.equal(readOnly.root.findAllByProps({ type: 'file' }).length, 0)
  assert.equal(buttonNamed(readOnly.root, 'Remover logo'), undefined)
  assert.equal(buttonNamed(readOnly.root, 'Salvar alterações'), undefined)
})

test('business profile layout uses theme tokens, two-column desktop composition and one-column mobile fallback', async () => {
  const css = await readFile(new URL('./business-profile-settings.css', import.meta.url), 'utf8')
  assert.match(css, /var\(--surface\)/)
  assert.match(css, /var\(--text\)/)
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})
