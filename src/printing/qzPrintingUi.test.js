import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const settings = await readFile(new URL('../components/PrintingSettings.jsx', import.meta.url), 'utf8')

test('Windows printing settings expose QZ Tray queue configuration without regressing RawBT', () => {
  assert.match(settings, /QZ Tray/)
  assert.match(settings, /Configurar impressora|Trocar impressora/)
  assert.match(settings, /SystemSelect/)
  assert.match(settings, /RawBT/)
  assert.match(settings, /transportReady/)
  assert.doesNotMatch(settings, /Windows \+ Chrome com Web Serial disponível/)
})
