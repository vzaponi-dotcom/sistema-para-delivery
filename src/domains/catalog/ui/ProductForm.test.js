import test from 'node:test'
import assert from 'node:assert/strict'
import React, { useState } from 'react'
import { act, create } from 'react-test-renderer'
import { createUiHarness } from '../test-support/harness.js'

const nodeText = (node) => {
  const children = node?.children ?? []
  return children.map((child) => typeof child === 'string' ? child : nodeText(child)).join('')
}

const baseValue = {
  category: 'Refeições',
  presentationType: 'size',
  presentationValue: 'P',
  presentationUnit: '',
  name: 'Produto',
  price: 'R$ 32,00',
}

async function loadForm(t) {
  const h = await createUiHarness(t)
  return (await h.load('/src/domains/catalog/ui/ProductForm.jsx')).default
}

test('new ProductForm normalizes price to zero once and preserves input identity while typing', async (t) => {
  const ProductForm = await loadForm(t)
  let latest
  function Wrapper() {
    const [value, setValue] = useState(baseValue)
    latest = value
    return React.createElement(ProductForm, {
      value,
      onChange: setValue,
      onSubmit() {},
      onCancel() {},
      editing: false,
    })
  }

  let renderer
  await act(async () => { renderer = create(React.createElement(Wrapper)) })
  t.after(async () => { await act(async () => renderer.unmount()) })

  const findName = () => renderer.root.findByProps({ placeholder: 'Ex: Marmita executiva' })
  const findPrice = () => renderer.root.findByProps({ placeholder: 'R$ 0,00' })
  const nameInput = findName()
  const priceInput = findPrice()
  assert.equal(latest.price, 'R$ 0,00')

  await act(async () => nameInput.props.onChange({ target: { value: 'Água' } }))
  assert.equal(latest.name, 'Água')
  assert.equal(latest.price, 'R$ 0,00')
  assert.strictEqual(findName(), nameInput)

  await act(async () => priceInput.props.onChange({ target: { value: '1234' } }))
  assert.equal(latest.price, 'R$ 12,34')
  assert.strictEqual(findPrice(), priceInput)
})

test('editing ProductForm keeps the existing price instead of applying the new-product zero', async (t) => {
  const ProductForm = await loadForm(t)
  const changes = []
  let renderer
  await act(async () => {
    renderer = create(React.createElement(ProductForm, {
      value: { ...baseValue, price: 'R$ 42,00' },
      onChange: (next) => changes.push(next),
      onSubmit() {},
      onCancel() {},
      editing: true,
    }))
  })
  t.after(async () => { await act(async () => renderer.unmount()) })
  assert.equal(renderer.root.findByProps({ placeholder: 'R$ 0,00' }).props.value, 'R$ 42,00')
  assert.deepEqual(changes, [])
})

test('ProductForm exposes the existing presentation validation matrix in submit state and inline errors', async (t) => {
  const ProductForm = await loadForm(t)
  let renderer
  const renderValue = async (value) => {
    const element = React.createElement(ProductForm, {
      value: { ...baseValue, ...value },
      onChange() {},
      onSubmit() {},
      onCancel() {},
      editing: true,
    })
    if (!renderer) await act(async () => { renderer = create(element) })
    else await act(async () => renderer.update(element))
  }
  t.after(async () => { if (renderer) await act(async () => renderer.unmount()) })

  const saveButton = () => renderer.root.findAllByType('button').find((node) => nodeText(node).includes('Salvar alterações'))
  const alerts = () => renderer.root.findAllByProps({ role: 'alert' })

  for (const value of [
    { presentationType: 'unit', presentationValue: '', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'P', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'M', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'G', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'Família', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'x'.repeat(24), presentationUnit: '' },
    { presentationType: 'volume', presentationValue: '1,5', presentationUnit: 'L' },
    { presentationType: 'volume', presentationValue: '350', presentationUnit: 'ml' },
    { presentationType: 'weight', presentationValue: '0.5', presentationUnit: 'kg' },
    { presentationType: 'weight', presentationValue: '500', presentationUnit: 'g' },
  ]) {
    await renderValue(value)
    assert.equal(saveButton().props.disabled, false, JSON.stringify(value))
    assert.equal(alerts().length, 0, JSON.stringify(value))
  }

  for (const value of [
    { presentationType: 'size', presentationValue: '', presentationUnit: '' },
    { presentationType: 'size', presentationValue: 'x'.repeat(25), presentationUnit: '' },
    { presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' },
    { presentationType: 'volume', presentationValue: 'abc', presentationUnit: 'ml' },
    { presentationType: 'volume', presentationValue: '1', presentationUnit: 'g' },
    { presentationType: 'weight', presentationValue: '-1', presentationUnit: 'kg' },
    { presentationType: 'weight', presentationValue: '1', presentationUnit: 'ml' },
  ]) {
    await renderValue(value)
    assert.equal(saveButton().props.disabled, true, JSON.stringify(value))
    assert.equal(alerts().length, 1, JSON.stringify(value))
  }
})

test('ProductForm keeps current category and presentation reset rules', async (t) => {
  const ProductForm = await loadForm(t)
  const changes = []
  let renderer
  await act(async () => {
    renderer = create(React.createElement(ProductForm, {
      value: baseValue,
      onChange: (next) => changes.push(next),
      onSubmit() {},
      onCancel() {},
      editing: true,
    }))
  })
  t.after(async () => { await act(async () => renderer.unmount()) })

  const buttonNamed = (name) => renderer.root.findAllByType('button').find((node) => nodeText(node) === name)
  await act(async () => buttonNamed('Bebidas').props.onClick())
  assert.deepEqual(changes.at(-1), {
    ...baseValue,
    category: 'Bebidas',
    presentationType: 'volume',
    presentationValue: '',
    presentationUnit: 'ml',
  })

  await act(async () => buttonNamed('Peso').props.onClick())
  assert.deepEqual(changes.at(-1), {
    ...baseValue,
    presentationType: 'weight',
    presentationValue: '',
    presentationUnit: 'g',
  })

  await act(async () => buttonNamed('Tamanho').props.onClick())
  assert.deepEqual(changes.at(-1), {
    ...baseValue,
    presentationType: 'size',
    presentationValue: 'P',
    presentationUnit: '',
  })
})
