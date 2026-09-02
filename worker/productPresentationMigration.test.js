import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0005_product_presentation.sql', import.meta.url), 'utf8')

test('product presentation migration is additive and preserves unknown categories', () => {
  assert.match(sql, /ADD COLUMN presentation_type/)
  assert.match(sql, /ADD COLUMN presentation_value/)
  assert.match(sql, /ADD COLUMN presentation_unit/)
  assert.match(sql, /WHEN 'Marmita' THEN 'Refeições'/)
  assert.match(sql, /WHEN 'Bebida' THEN 'Bebidas'/)
  assert.match(sql, /WHEN 'Doce' THEN 'Sobremesas'/)
  assert.match(sql, /WHEN 'Adicional' THEN 'Adicionais'/)
  assert.match(sql, /ELSE category/)
  assert.doesNotMatch(sql, /DELETE FROM products|DROP TABLE products/i)
})
