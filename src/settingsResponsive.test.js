import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'

import { workspaceHarness, nodeText } from './test-support/renderWorkspace.js'

const settingsCss = await readFile(new URL('./settings.css', import.meta.url), 'utf8')
const appCss = await readFile(new URL('./App.css', import.meta.url), 'utf8')
const mobileFoundationCss = await readFile(new URL('./mobile-foundation.css', import.meta.url), 'utf8')

const rule = (css, selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('production styles define fluid desktop/tablet cards and the mobile stacked settings contract', () => {
  assert.match(settingsCss, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*240px\),\s*1fr\)\)/)
  assert.match(settingsCss, /@media \(max-width: 640px\)[\s\S]*\.settings-item-row[\s\S]*flex-direction:\s*column/)
  assert.match(settingsCss, /@media \(max-width: 640px\)[\s\S]*\.operation-timing-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})

test('an 80-character catalog name wraps while its actions remain reachable', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: SettingsItemList } = await h.load('/src/components/SettingsItemList.jsx')
  const longName = 'Categoria financeira com nome longo '.padEnd(80, 'X')
  const screen = await h.render(SettingsItemList, {
    label: 'Categorias', items: [{ id: 'long', label: longName }],
    getActions: () => [{ id: 'move-down', label: 'Mover para baixo' }], onAction() {},
  })
  const row = screen.root.findByProps({ className: 'settings-item-row' })
  assert.match(nodeText(row), new RegExp(longName))
  assert.equal(row.findAllByType('button').length, 1)
  assert.match(rule(settingsCss, '.settings-item-copy strong'), /overflow-wrap:\s*anywhere/)
})

test('badges, save footer and modal remain inside mobile and zoomed viewports', () => {
  assert.match(rule(settingsCss, '.settings-editor-footer'), /safe-area-inset-bottom/)
  assert.match(mobileFoundationCss, /--mobile-content-bottom-space:[^;]*--mobile-bottom-nav-height/)
  assert.match(rule(appCss, '.modal-card'), /max-height:\s*min\(88vh,\s*760px\)/)
  assert.match(appCss, /@media \(max-width: 820px\)[\s\S]*\.modal-card\s*\{[\s\S]*max-height:\s*92vh/)
  assert.match(rule(settingsCss, '.settings-catalog-badge'), /overflow-wrap:\s*anywhere/)
})
