import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as localStation from '../printing/localPrintStation.js'

const content = await readFile(new URL('./PrintingSettingsContent.jsx', import.meta.url), 'utf8')
const page = await readFile(new URL('../pages/Settings.jsx', import.meta.url), 'utf8')
const icons = await readFile(new URL('./Icon.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../printing/printing.css', import.meta.url), 'utf8')

test('visual platform detection recognizes Windows Android and iPhone without changing transport platform semantics', () => {
  const detect = localStation.detectPrintStationUiPlatform
  assert.equal(typeof detect, 'function')
  if (typeof detect !== 'function') return

  assert.equal(detect('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows')
  assert.equal(detect('Mozilla/5.0 (Linux; Android 15; Pixel 8)'), 'android')
  assert.equal(detect('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios')
  assert.equal(detect('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'), 'ios')
  assert.equal(detect('Mozilla/5.0 (X11; Linux x86_64)'), 'other')

  assert.equal(localStation.detectPrintStationPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'other')
})

test('icon catalog exposes platform-specific Windows Android and Apple symbols', () => {
  assert.match(icons, /windows:\s*</)
  assert.match(icons, /android:\s*</)
  assert.match(icons, /apple:\s*</)
})

test('printing route uses the homologated breadcrumb header without legacy horizontal settings tabs', () => {
  assert.match(page, /if \(printingRoute\)[\s\S]*title="Impressão de pedidos"/)
  const printingBlock = page.match(/if \(printingRoute\)[\s\S]*?return \(/)?.[0] || ''
  assert.doesNotMatch(printingBlock, /AreaNavigation/)
})

test('printing content renders three compact cards following the approved visual hierarchy', () => {
  assert.equal((content.match(/<section className="printing-settings-card/g) || []).length, 3)
  for (const label of [
    'Política de impressão do negócio',
    'Pedidos',
    'Mesas / Comandas',
    'Estação',
    'Nome da estação',
    'Plataforma',
    'Estação principal',
    'Impressão automática',
    'Impressora local \(QZ Tray\)',
    'Status da impressora',
    'Impressora configurada',
    'Testar impressão',
    'Trocar impressora',
  ]) assert.match(content, new RegExp(label))

  assert.match(content, /label="Vias de pedidos"/)
  assert.match(content, /label="Vias de mesas e comandas"/)
  assert.match(content, /detectPrintStationUiPlatform/)
  assert.match(content, /Icon name=\{platformIcon\}/)
})

test('printing redesign keeps policy station and local printer saves independent', () => {
  assert.match(content, /settings\.savePolicy\(\)/)
  assert.match(content, /settings\.saveStation\(\)/)
  assert.match(content, /settings\.savePrinter\(selectedPrinter\)/)
  assert.doesNotMatch(content, /Salvar tudo|saveAll/)
})

test('queue-only devices stay honest while QZ devices expose physical printer controls', () => {
  assert.match(content, /!isQz[\s\S]*Fila central/)
  assert.match(content, /isQz[\s\S]*Trocar impressora/)
  assert.match(content, /canExecutePrinting[\s\S]*Testar impressão/)
  assert.match(content, /pendingCount/)
  assert.match(content, /awaitingConfirmationCount/)
})

test('printing redesign CSS defines card hierarchy platform presentation and mobile stacking', () => {
  for (const selector of [
    '.printing-settings-card',
    '.printing-settings-card-header',
    '.printing-settings-card-icon',
    '.printing-platform-value',
    '.printing-local-layout',
    '.printing-settings-footer',
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.printing-settings-card-grid[\s\S]*grid-template-columns:\s*1fr/)
  assert.doesNotMatch(css, /var\(--[^,]+,\s*#[0-9a-f]{3,8}\)/i)
})
