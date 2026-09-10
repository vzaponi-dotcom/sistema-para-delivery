import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runManualPrintDocument } from './manualPrintDocument.js'

test('manual document renders and transports identical bytes exactly once as one copy', async () => {
  const document = { type: 'table-tab', tableTab: { id: 'tab-42' } }
  const bytes = new Uint8Array([1, 2, 3])
  const calls = []
  const result = await runManualPrintDocument({
    document,
    port: 'port-1',
    renderer: (received, options) => {
      calls.push(['render', received, options])
      return bytes
    },
    transport: async (port, received) => { calls.push(['transport', port, received]) },
  })

  assert.deepEqual(result, { status: 'printed', copiesPrinted: 1 })
  assert.deepEqual(calls, [
    ['render', document, { copies: 1 }],
    ['transport', 'port-1', bytes],
  ])
})

test('manual document preserves transport rejection and never owns queue jobs', async () => {
  const failure = Object.assign(new Error('Impressora desconectada'), { code: 'SERIAL_OPEN_FAILED' })
  await assert.rejects(
    runManualPrintDocument({
      document: { type: 'table-tab' },
      port: null,
      renderer: () => new Uint8Array([9]),
      transport: async () => { throw failure },
    }),
    (error) => error === failure,
  )

  const source = await readFile(new URL('./manualPrintDocument.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /createManualPrintJob|claimPrintJob|completePrintJob|failPrintJob|api\/client/)
})
