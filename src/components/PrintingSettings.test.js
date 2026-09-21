import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const settings = await readFile(new URL('../domains/printing/ui/PrintingSettingsContent.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../domains/orders/ui/Orders.jsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../domains/printing/application/usePrintingManager.js', import.meta.url), 'utf8')
const adapter = await readFile(new URL('../app/surfaces/settings/printingSettingsAdapter.js', import.meta.url), 'utf8')
const css = await readFile(new URL('../domains/printing/ui/printing.css', import.meta.url), 'utf8')

test('printing settings keep the three scoped responsibilities explicit in compact cards', () => {
  for (const label of ['Política de impressão do negócio', 'Pedidos', 'Mesas / Comandas', 'Estação', 'Impressão nesta estação', 'Impressão do negócio']) {
    assert.match(settings, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.equal((settings.match(/<section className="printing-settings-card/g) || []).length, 3)
  assert.match(settings, /Apenas novas solicitações de impressão\. A fila existente mantém suas vias\./)
})

test('business policy, station and local printer expose independent save actions', () => {
  assert.match(settings, /settings\.savePolicy\(\)/)
  assert.match(settings, /settings\.saveStation\(\)/)
  assert.match(settings, /settings\.savePrinter\(selectedPrinter\)/)
  assert.doesNotMatch(settings, /Salvar tudo|saveAll/)
})

test('the printing adapter delegates remote state only to policy editing', () => {
  for (const resource of ['printingPolicy', 'stationConfiguration', 'stationPrimary']) {
    assert.match(adapter, new RegExp(`policyEditing[\\s\\S]*'${resource}'`))
  }
  assert.doesNotMatch(adapter, /useState|useEffect|getPrintSettings|savePrintSettings/)
  assert.doesNotMatch(manager, /makePrimaryPrintStation|saveStationSettings/)
})

test('making a station primary remains an explicit confirmed action', () => {
  assert.match(settings, /ConfirmationDialog/)
  assert.match(settings, /confirmLabel="Tornar principal"/)
  assert.match(settings, /única responsável pela impressão automática/)
  assert.match(settings, /settings\.makePrimary\(\)/)
})

test('automatic printing stays visible but disabled until this QZ station is primary', () => {
  assert.match(settings, /stationIsPrimary \? 'Imprime novos pedidos automaticamente ao receber\.' : 'Disponível somente na estação principal\.'/)
  assert.match(settings, /disabled=\{!canConfigureStation \|\| stationBlocked \|\| !stationIsPrimary\}/)
})

test('queue-only devices cannot expose physical or automatic printing controls', () => {
  assert.match(settings, /isQz \? 'Impressão nesta estação' : 'Impressão do negócio'/)
  assert.match(settings, /Esta estação acompanha a fila central e não realiza impressão física/)
  assert.match(settings, /isQz && <label className="printing-switch-row"/)
  assert.match(settings, /isQz && \(canConfigureStation \|\| canExecutePrinting\)/)
  assert.match(settings, /isQz && canConfigureStation && printerEditing[\s\S]*<SystemSelect/)
  assert.match(settings, /canExecutePrinting && <Button[^>]*>[\s\S]*Testar impressão/)
})

test('operational status and pending attention remain visible without owning remote settings', () => {
  assert.match(settings, /derivePrintOperationalStatus/)
  assert.match(settings, /buildPrintOperationalView/)
  assert.match(settings, /Status da impressão/)
  assert.match(settings, /pendingCount/)
  assert.match(settings, /awaitingConfirmationCount/)
  assert.match(settings, /trabalhos aguardando impressão/)
})

test('Orders header keeps only the focused kitchen actions', () => {
  assert.doesNotMatch(orders, />Configurações</)
  assert.match(orders, />Fila de impressão</)
  assert.match(orders, />Novo pedido</)
})

test('manager distinguishes queue-only and QZ connection states honestly', () => {
  assert.match(manager, /'unsupported'/)
  assert.match(manager, /'unconfigured'/)
  assert.match(manager, /'disconnected'/)
  assert.match(manager, /'connected'/)
  assert.doesNotMatch(manager, /getPrinterFingerprint|navigator\.serial/)
})

test('printing settings styling uses semantic tokens and complete interaction states', () => {
  assert.doesNotMatch(css, /var\(--[^,]+,\s*#[0-9a-f]{3,8}\)/i)
  assert.match(css, /\.printing-settings-card[\s\S]*background:\s*var\(--surface\)/)
  assert.match(css, /\.printing-switch-row input:checked[\s\S]*background:\s*var\(--primary\)/)
  assert.match(css, /\.printing-settings[^}]*color:\s*var\(--text\)/)
  assert.match(css, /\.printing-settings[\s\S]*:focus-visible/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.printing-settings-footer[\s\S]*width:\s*100%/)
})
