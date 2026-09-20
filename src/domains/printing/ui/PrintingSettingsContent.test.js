import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import * as printing from '../index.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Printing owns PrintingSettingsContent behind its public surface', () => {
  assert.equal(typeof printing.PrintingSettingsContent, 'function')
  assert.equal(existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url)), true)
  assert.equal(existsSync(new URL('../../../components/PrintingSettingsContent.jsx', import.meta.url)), false)
})

test('Printing Settings keeps independent order and table copy fields after the move', () => {
  assert.equal(existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url)), true)
  if (!existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url))) return
  const settingsSource = read('./PrintingSettingsContent.jsx')
  assert.match(settingsSource, /orderDefaultCopies/)
  assert.match(settingsSource, /tableTabDefaultCopies/)
  assert.match(settingsSource, /Apenas novas solicitações de impressão/)
})

test('SettingsSurface consumes Printing settings UI only through the public entry', () => {
  const surface = read('../../../app/surfaces/settings/SettingsSurface.jsx')
  assert.match(surface, /domains\/printing\/index\.js/)
  assert.doesNotMatch(surface, /components\/PrintingSettingsContent\.jsx/)
})
