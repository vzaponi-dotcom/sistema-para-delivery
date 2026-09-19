import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createUiHarness } from '../test-support/harness.js'

const nodeText = (node) => (node?.children ?? [])
  .map((child) => typeof child === 'string' ? child : nodeText(child))
  .join('')

const product = {
  id: 'p1',
  name: 'Água',
  category: 'Bebidas',
  price: 3,
  presentationType: 'unit',
}

const baseProps = {
  visible: true,
  products: [product],
  search: '',
  queryState: { categoryFilter: 'Todos' },
  onSearchChange() {},
  onQueryChange() {},
  currency: (value) => `R$ ${value}`,
  writesBlocked: false,
  canManageProducts: true,
  applyOfficialEffects() {},
  setRequestKey() {},
  onSuccess() {},
  onError(error) { throw error },
}

async function loadWorkspace(t) {
  const h = await createUiHarness(t)
  return (await h.load('/src/domains/catalog/ui/CatalogWorkspace.jsx')).default
}

test('CatalogWorkspace preserves editor state while hidden and resets it after unmount', async (t) => {
  const Workspace = await loadWorkspace(t)
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator ?? {}, 'onLine')
  if (globalThis.navigator) Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  t.after(() => {
    if (!globalThis.navigator) return
    if (navigatorDescriptor) Object.defineProperty(globalThis.navigator, 'onLine', navigatorDescriptor)
    else delete globalThis.navigator.onLine
  })

  let renderer
  await act(async () => { renderer = create(React.createElement(Workspace, baseProps)) })

  const addButton = renderer.root.findAllByType('button').find((node) => nodeText(node).includes('Adicionar produto'))
  assert.ok(addButton)
  await act(async () => addButton.props.onClick())

  const nameInput = () => renderer.root.findByProps({ placeholder: 'Ex: Marmita executiva' })
  await act(async () => nameInput().props.onChange({ target: { value: 'Suco especial' } }))
  assert.equal(nameInput().props.value, 'Suco especial')

  await act(async () => renderer.update(React.createElement(Workspace, { ...baseProps, visible: false })))
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Buscar produto, categoria, apresentação ou preço' }).length, 0)
  assert.equal(nameInput().props.value, 'Suco especial')

  await act(async () => renderer.update(React.createElement(Workspace, { ...baseProps, visible: true })))
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Buscar produto, categoria, apresentação ou preço' }).length, 1)
  assert.equal(nameInput().props.value, 'Suco especial')

  await act(async () => renderer.unmount())

  await act(async () => { renderer = create(React.createElement(Workspace, baseProps)) })
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Ex: Marmita executiva' }).length, 0)
  await act(async () => renderer.unmount())
})

test('CatalogWorkspace unmounts list-local selection while hidden but preserves controlled query props', async (t) => {
  const Workspace = await loadWorkspace(t)
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator ?? {}, 'onLine')
  if (globalThis.navigator) Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  t.after(() => {
    if (!globalThis.navigator) return
    if (navigatorDescriptor) Object.defineProperty(globalThis.navigator, 'onLine', navigatorDescriptor)
    else delete globalThis.navigator.onLine
  })

  const props = {
    ...baseProps,
    search: 'água',
    queryState: { categoryFilter: 'Bebidas' },
  }
  let renderer
  await act(async () => { renderer = create(React.createElement(Workspace, props)) })

  assert.equal(renderer.root.findByProps({ type: 'search' }).props.value, 'água')
  await act(async () => renderer.root.findByProps({ className: 'product-select-mode-button' }).props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Selecionar Água' }).props.onClick({ stopPropagation() {} }))
  assert.equal(renderer.root.findAllByProps({ className: 'product-selection-toolbar' }).length, 1)

  await act(async () => renderer.update(React.createElement(Workspace, { ...props, visible: false })))
  assert.equal(renderer.root.findAllByProps({ className: 'product-selection-toolbar' }).length, 0)

  await act(async () => renderer.update(React.createElement(Workspace, props)))
  assert.equal(renderer.root.findByProps({ type: 'search' }).props.value, 'água')
  assert.equal(renderer.root.findAllByProps({ className: 'product-selection-toolbar' }).length, 0)

  await act(async () => renderer.unmount())
})

test('CatalogWorkspace read-only context exposes list/search without management actions or editor', async (t) => {
  const Workspace = await loadWorkspace(t)
  let renderer
  await act(async () => {
    renderer = create(React.createElement(Workspace, { ...baseProps, canManageProducts: false }))
  })

  assert.equal(renderer.root.findAllByProps({ type: 'search' }).length, 1)
  assert.equal(renderer.root.findAllByProps({ className: 'product-select-mode-button' }).length, 0)
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Ações de Água' }).length, 0)
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Ex: Marmita executiva' }).length, 0)

  await act(async () => renderer.unmount())
})
