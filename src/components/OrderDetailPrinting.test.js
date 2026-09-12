import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

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
