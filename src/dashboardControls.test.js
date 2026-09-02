import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard period selector exposes Hoje 7 dias and 30 dias as pressed buttons', () => {
  const selector = source('./components/DashboardPeriodSelector.jsx')

  assert.match(selector, /Hoje/)
  assert.match(selector, /7 dias/)
  assert.match(selector, /30 dias/)
  assert.match(selector, /aria-pressed=\{value === option\.value\}/)
  assert.match(selector, /onClick=\{\(\) => onChange\(option\.value\)\}/)
  assert.match(selector, /aria-label="Período da análise"/)
})

test('icon set includes visible and hidden eye icons', () => {
  const icon = source('./components/Icon.jsx')

  assert.match(icon, /eye:/)
  assert.match(icon, /['"]eye-off['"]:/)
})
