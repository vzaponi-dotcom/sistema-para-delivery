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
      writesBlocked: options.writesBlocked || false,
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
  await act(async () => input.props.onChange({ target: { files: [new Blob(['second'], { type: 'image/webp' })] } }))

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


test('offline write blocking keeps local logo preview editable but never calls save', async (t) => {
  const { screen, edits, saves } = await renderEditor(t, { writesBlocked: true })
  const file = new Blob(['offline-source'], { type: 'image/png' })
  const input = screen.root.findByProps({ type: 'file' })

  await act(async () => input.props.onChange({ target: { files: [file], value: 'offline.png' } }))

  assert.equal(edits.at(-1).logoAction, 'replace')
  assert.match(screen.root.findByProps({ alt: 'Logo da operação' }).props.src, /^blob:business-logo-/)
  const save = buttonNamed(screen.root, 'Salvar alterações')
  assert.equal(save.props.disabled, true)
  await act(async () => save.props.onClick())
  assert.equal(saves.length, 0)
  assert.match(nodeText(screen.root), /sem conexão|reconecte/i)
})

test('conflict resolution keeps local bytes only while the final draft still points to the same local logo token', async (t) => {
  const h = await workspaceHarness(t)
  const { default: BusinessProfileSettings } = await h.load('/src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx')
  const normalizedBlob = new Blob(['conflict-logo'], { type: 'image/webp' })
  const localVersion = `local:${'b'.repeat(64)}`
  const saves = []
  const previewEvents = []
  const api = React.createRef()

  function Harness() {
    const [state, setState] = React.useState(resourceState())
    React.useImperativeHandle(api, () => ({ setState }), [])
    return React.createElement(BusinessProfileSettings, {
      resourceState: state,
      normalizeLogo: async () => ({
        blob: normalizedBlob,
        sha256: 'b'.repeat(64),
        width: 512,
        height: 512,
        sizeBytes: normalizedBlob.size,
        contentType: 'image/webp',
      }),
      previewOwnerFactory: () => ({
        replace() { previewEvents.push('replace'); return 'blob:conflict-preview' },
        clear() { previewEvents.push('clear') },
        dispose() { previewEvents.push('dispose') },
      }),
      onEdit: (draft) => setState((current) => ({ ...current, draft, dirty: true })),
      onSave: async (transient) => { saves.push(transient); return false },
      onDiscard() {},
      onReconcile() {},
      onReload() {},
      onReviewConflict() {},
      onNavigateHome() {},
    })
  }

  const screen = await h.render(Harness)
  await act(async () => screen.root.findByProps({ type: 'file' }).props.onChange({
    target: { files: [new Blob(['source'], { type: 'image/png' })], value: 'logo.png' },
  }))
  assert.equal(screen.root.findByProps({ alt: 'Logo da operação' }).props.src, 'blob:conflict-preview')

  await act(async () => api.current.setState((current) => ({
    ...current,
    status: 'ready',
    draft: {
      ...current.draft,
      name: 'Rascunho preservado',
      logo: { present: true, version: localVersion },
      logoAction: 'keep',
    },
    dirty: true,
  })))
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(saves.at(-1).logoBlob, normalizedBlob, 'local token keeps the transient bytes even if conflict merge kept a stale action flag')

  await act(async () => api.current.setState((current) => ({
    ...current,
    status: 'ready',
    draft: {
      ...current.draft,
      name: 'Escolha atual',
      logo: { present: true, version: 'server-after-conflict' },
      logoAction: 'replace',
    },
    dirty: true,
  })))
  assert.equal(screen.root.findByProps({ alt: 'Logo da operação' }).props.src, '/api/business/logo?v=server-after-conflict')
  assert.equal(previewEvents.filter((event) => event === 'clear').length >= 1, true)

  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(saves.at(-1), undefined, 'server/current logo choice must not reuse the old local Blob')
})

test('session or business context reset clears local preview and prevents a new business from reusing the previous Blob', async (t) => {
  const h = await workspaceHarness(t)
  const { default: BusinessProfileSettings } = await h.load('/src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx')
  const normalizedBlob = new Blob(['business-a-logo'], { type: 'image/webp' })
  const previewEvents = []
  const saves = []
  const api = React.createRef()

  function Harness() {
    const [state, setState] = React.useState(resourceState())
    React.useImperativeHandle(api, () => ({ setState }), [])
    return React.createElement(BusinessProfileSettings, {
      resourceState: state,
      normalizeLogo: async () => ({
        blob: normalizedBlob,
        sha256: 'c'.repeat(64),
        width: 400,
        height: 400,
        sizeBytes: normalizedBlob.size,
        contentType: 'image/webp',
      }),
      previewOwnerFactory: () => ({
        replace() { previewEvents.push('replace'); return 'blob:business-a' },
        clear() { previewEvents.push('clear') },
        dispose() { previewEvents.push('dispose') },
      }),
      onEdit: (draft) => setState((current) => ({ ...current, draft, dirty: true })),
      onSave: async (transient) => { saves.push(transient); return false },
      onDiscard() {},
      onReconcile() {},
      onReload() {},
      onReviewConflict() {},
      onNavigateHome() {},
    })
  }

  const screen = await h.render(Harness)
  await act(async () => screen.root.findByProps({ type: 'file' }).props.onChange({
    target: { files: [new Blob(['source-a'], { type: 'image/jpeg' })], value: 'a.jpg' },
  }))
  assert.equal(screen.root.findByProps({ alt: 'Logo da operação' }).props.src, 'blob:business-a')

  await act(async () => api.current.setState({
    status: 'idle', confirmed: null, base: null, draft: null, submitted: null, dirty: false, error: null,
  }))
  assert.equal(previewEvents.includes('clear'), true)

  const businessB = data({
    name: 'Negócio B',
    logo: { present: false, version: null },
    logoAction: 'keep',
  })
  await act(async () => api.current.setState({
    status: 'ready',
    confirmed: { revision: 1, data: businessB, meta: {} },
    base: { revision: 1, data: businessB, meta: {} },
    draft: businessB,
    submitted: null,
    dirty: false,
    error: null,
  }))
  await act(async () => screen.root.findByProps({ name: 'name' }).props.onChange({ target: { value: 'Negócio B atualizado' } }))
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(saves.at(-1), undefined)
})

test('unconfirmed business profile cannot be discarded while the generic owner awaits reconciliation', async (t) => {
  const h = await workspaceHarness(t)
  const { default: BusinessProfileSettings } = await h.load('/src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx')
  let discards = 0
  const screen = await h.render(BusinessProfileSettings, {
    resourceState: resourceState({ status: 'unconfirmed', dirty: true }),
    onEdit() {},
    onSave() {},
    onDiscard: () => { discards += 1 },
    onReconcile() {},
    onReload() {},
    onReviewConflict() {},
    onNavigateHome() {},
  })

  const cancel = buttonNamed(screen.root, 'Cancelar')
  assert.equal(cancel.props.disabled, true)
  await act(async () => cancel.props.onClick())
  assert.equal(discards, 0)
})


test('business profile formats phone/CEP, restricts address number and selects UF through the shared SystemSelect', async (t) => {
  const { screen, edits } = await renderEditor(t)

  const phone = screen.root.findByProps({ name: 'phone' })
  assert.equal(phone.props.type, 'tel')
  assert.equal(phone.props.inputMode, 'tel')
  await act(async () => phone.props.onChange({ target: { value: '19abc999999999' } }))
  assert.equal(edits.at(-1).phone, '(19) 99999-9999')

  const number = screen.root.findByProps({ name: 'address.number' })
  assert.equal(number.props.inputMode, 'numeric')
  assert.equal(number.props.maxLength, 10)
  await act(async () => number.props.onChange({ target: { value: '12A-3456789012' } }))
  assert.equal(edits.at(-1).address.number, '1234567890')

  const postal = screen.root.findByProps({ name: 'address.postalCode' })
  assert.equal(postal.props.value, '13190-000')
  assert.equal(postal.props.maxLength, 9)
  await act(async () => postal.props.onChange({ target: { value: '13a190-0009' } }))
  assert.equal(edits.at(-1).address.postalCode, '13190000')

  assert.equal(screen.root.findAllByProps({ name: 'address.state' }).length, 0)
  const uf = screen.root.findByProps({ role: 'combobox', 'aria-label': 'UF' })
  await act(async () => uf.props.onClick())
  const option = buttonNamed(screen.root, 'RJ — Rio de Janeiro')
  assert.ok(option)
  await act(async () => option.props.onClick())
  assert.equal(edits.at(-1).address.state, 'RJ')
})

test('business profile blocks incomplete phone and CEP with field-specific inline feedback', async (t) => {
  const { screen, saves } = await renderEditor(t)

  await act(async () => screen.root.findByProps({ name: 'phone' }).props.onChange({ target: { value: '199999999' } }))
  await act(async () => screen.root.findByProps({ name: 'address.postalCode' }).props.onChange({ target: { value: '1319' } }))
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())

  assert.equal(saves.length, 0)
  assert.match(nodeText(screen.root), /Informe um telefone válido com DDD/)
  assert.match(nodeText(screen.root), /Informe um CEP válido com 8 dígitos/)
  assert.equal(screen.root.findByProps({ name: 'phone' }).props['aria-invalid'], true)
  assert.equal(screen.root.findByProps({ name: 'address.postalCode' }).props['aria-invalid'], true)
})
