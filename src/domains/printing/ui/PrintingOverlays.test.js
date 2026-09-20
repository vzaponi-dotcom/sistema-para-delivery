import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

const overlayUrl = new URL('./PrintingOverlays.jsx', import.meta.url)
const appSource = await readFile(new URL('../../../App.jsx', import.meta.url), 'utf8')

test('PrintingOverlays owns the existing dialog copy without redesign', async () => {
  assert.equal(existsSync(overlayUrl), true)
  if (!existsSync(overlayUrl)) return
  const source = await readFile(overlayUrl, 'utf8')
  for (const label of [
    'Impressora disponível novamente',
    'Via impressa',
    'Descartar ',
    ' trabalhos?',
    '1ª via impressa',
    'Imprimir 2ª via',
    'Parar por agora',
    'Depois',
    'Solicitar 2ª via',
  ]) assert.equal(source.includes(label), true, label)
})

test('App renders one PrintingOverlays composition point with only approved inputs', () => {
  assert.match(appSource, /<PrintingOverlays[\s\S]*printing=\{printing\}[\s\S]*orders=\{orders\}[\s\S]*authenticated=\{authState === 'authenticated'\}[\s\S]*canExecutePrinting=\{canExecutePrinting\}[\s\S]*canDiscardPrinting=\{canDiscardPrinting\}[\s\S]*onError=\{showApiError\}[\s\S]*onSuccess=\{showSuccessMessage\}/)
})
