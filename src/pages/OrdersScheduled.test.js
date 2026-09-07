import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const readSourceTree = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const parts = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
    if (entry.isDirectory()) return readSourceTree(url)
    return entry.name.endsWith('.test.js') ? '' : readFile(url, 'utf8')
  }))
  return parts.flat(Infinity).join('\n')
}

test('orders page composes the approved kitchen heading, actions, counters, and persistent queues', async () => {
  const source = await read('./Orders.jsx')
  const requiredCopy = [
    'Cozinha',
    'Acompanhe os pedidos em preparo e agendados',
    'Som ativado',
    'Impressão',
    'Histórico',
    'Novo pedido',
    'Em preparo',
    'Agendados',
    'Fora do prazo',
    'Finalizados hoje',
    'Mais antigos primeiro',
    'Mais próximos primeiro',
    'Nenhum pedido em preparo agora.',
    'Nenhum pedido agendado aguardando preparo.',
  ]

  for (const text of requiredCopy) assert.match(source, new RegExp(text))
  assert.doesNotMatch(source, />Ver histórico</)
  assert.match(source, /buildKitchenQueueModel\(orders, now, search\)/)
  assert.match(source, /className="kitchen-page"/)
  assert.match(source, /className="kitchen-board"/)
  assert.equal(source.match(/className="kitchen-queue-section"/g)?.length, 2)
  assert.match(source, /<KitchenTicket/)
  assert.match(source, /queueModel\.counts\.(?:preparing|scheduled|late|finishedToday)/)
  assert.match(source, /queueModel\.preparing/)
  assert.match(source, /queueModel\.scheduled/)
})

test('orders page wires ticket actions by phase and keeps global counts independent from search results', async () => {
  const source = await read('./Orders.jsx')
  const preparingBlock = source.slice(source.indexOf('queueModel.preparing.map'), source.indexOf('kitchen-scheduled-heading'))
  const scheduledBlock = source.slice(source.indexOf('queueModel.scheduled.map'), source.indexOf('!queueModel.scheduled.length'))
  assert.match(source, /onDetails=\{setDetailOrder\}/)
  assert.match(preparingBlock, /onFinalize=\{setFinalizeCandidate\}/)
  assert.doesNotMatch(preparingBlock, /onCancel=/)
  assert.match(scheduledBlock, /onCancel=\{setCancelOrder\}/)
  assert.doesNotMatch(scheduledBlock, /onFinalize=/)
  assert.doesNotMatch(source, /(?:preparing|scheduled)\.length[^\n]*StatCard/)
})

test('scheduled order details keep cancellation available and do not introduce editing', async () => {
  const source = await read('./Orders.jsx')

  assert.match(source, /<OrderDetail[\s\S]*onRequestCancel=\{\(\) =>/)
  assert.doesNotMatch(source, /isScheduledWaiting\(detailOrder, now\)\s*\?\s*undefined/)
  assert.doesNotMatch(source, /Editar pedido/)
  assert.doesNotMatch(source, /onEditOrder/)
})

test('legacy waiting-window copy is absent from application source', async () => {
  const allSource = await readSourceTree(new URL('../', import.meta.url))
  assert.doesNotMatch(allSource, /Aguardando janela/i)
})
