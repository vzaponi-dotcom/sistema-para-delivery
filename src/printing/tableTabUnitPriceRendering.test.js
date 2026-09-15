import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeCp860 } from './cp860.js'
import { renderEscPos58mm } from './escpos58mm.js'

const includesBytes = (haystack, needle) => {
  const source = [...haystack]
  const target = [...needle]
  return source.some((_, index) => target.every((byte, offset) => source[index + offset] === byte))
}

test('physical table-tab ticket prints unit price in addition to each line total', () => {
  const document = {
    version: 1,
    type: 'table-tab',
    business: { name: 'Amor & Sabor' },
    tableTab: { id: 'tab-22', number: 22, tableName: 'Mesa 3' },
    items: [
      { name: 'Marmita Carne G', presentation: '', note: '', quantity: 4, unitPriceCents: 2900, lineTotalCents: 11600 },
    ],
    financial: { totalCents: 11600 },
    message: 'PRE-CONTA - NAO E COMPROVANTE DE PAGAMENTO',
  }

  const bytes = renderEscPos58mm(document, { copies: 1 })
  assert.equal(includesBytes(bytes, encodeCp860('Unit. R$ 29,00')), true)
  assert.equal(includesBytes(bytes, encodeCp860('R$ 116,00')), true)
})
