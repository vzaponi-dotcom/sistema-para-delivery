import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { workspaceHarness, nodeText } from '../../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

const source = await readFile(new URL('./OrderDetail.jsx', import.meta.url), 'utf8')

test('terminal history without a retained job reprints from the order with either manual copy count', () => {
  assert.match(source, /const isHistoricalOrder = \['Finalizado', 'Cancelado'\]\.includes\(order\.status\)/)
  assert.match(source, /const reprintCopies = printJob\?\.copiesRequested === 1 \? 1 : defaultCopies/)
  assert.match(source, /const handleHistoricalReprint = \(\) => runPrintingAction\('historical-reprint', \(\) => printing\?\.printOrder\?\.\(order\.id, reprintCopies\)/)
  assert.match(source, /if \(!printJob && isHistoricalOrder\) return <Button[^>]*onClick=\{\(\) => \{ if \(canExecutePrinting\) setConfirmReprint\(true\) \}\}[^>]*disabled=\{printingDisabled \|\| !canExecutePrinting\}[^>]*>Reimprimir<\/Button>/)
})

test('retained historical job keeps the linked requestReprint path', () => {
  assert.match(source, /const handleConfirmedReprint = async \(\) => \{[\s\S]*printing\?\.requestReprint\?\.\(printJob, reprintCopies\)/)
  assert.match(source, /const reprintAction = printJob \? handleConfirmedReprint : handleHistoricalReprint/)
})

test('operator force action stays disabled even with ordinary execution', async (t) => {
  const harness = await workspaceHarness(t)
  const {default: OrderDetail} = await harness.load('/src/domains/orders/ui/components/OrderDetail.jsx')
  let calls = 0
  const renderer = await harness.render(OrderDetail, {
    order: {id:'o1',status:'Finalizado',items:[],total:20,orderDate:'2026-09-30'}, currency: String,
    printJob: {id:'job1', type:'order',status:'requires_attention', attentionReason:'ORDER_FINALIZED_BEFORE_PRINT'},
    canExecutePrinting:true, canForcePrinting:false, printing:{requestForcePrint:async()=>{calls++}}, onClose(){},
  })
  const button = renderer.root.findAllByType('button').find(node=>nodeText(node)==='Imprimir mesmo assim')
  assert.ok(button)
  assert.equal(button.props.disabled,true)
  await act(async()=>button.props.onClick())
  assert.equal(calls,0)
})
