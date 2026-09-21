import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const absent = (path) => assert.rejects(access(new URL(path, import.meta.url)), (error) => error?.code === 'ENOENT')

const uiOwners = [
  'BottomSheet.jsx',
  'Button.jsx',
  'ConfirmationDialog.jsx',
  'Icon.jsx',
  'Modal.jsx',
  'PageHeader.jsx',
  'StatCard.jsx',
  'StatusBadge.jsx',
  'SystemSelect.jsx',
  'scrollLock.js',
  'DashboardBarChart.jsx',
  'DashboardPeriodSelector.jsx',
]

test('generic multi-owner UI lives under src/shared/ui with no legacy owner copies', async () => {
  for (const name of uiOwners) {
    const source = await read(`./ui/${name}`)
    assert.ok(source.length > 0, name)
    await absent(`../components/${name}`)
  }
})

test('generic hook and pure formatting utilities live under frontend shared owners', async () => {
  const [media, formatting, comandas, productDraft] = await Promise.all([
    read('./hooks/useMediaQuery.js'),
    read('./utils/formFormatting.js'),
    read('../domains/table-service/ui/Comandas.jsx'),
    read('../domains/catalog/domain/productDraft.js'),
  ])

  assert.match(comandas, /shared\/hooks\/useMediaQuery\.js/)
  assert.doesNotMatch(comandas, /from ['"]\.\.\/\.\.\/\.\.\/hooks\/useMediaQuery\.js['"]/)
  assert.match(productDraft, /shared\/utils\/formFormatting\.js/)
  assert.doesNotMatch(productDraft, /from ['"]\.\.\/\.\.\/\.\.\/utils\/formFormatting\.js['"]/)
  assert.doesNotMatch(formatting, /from ['"]react|window|document|localStorage|sessionStorage|navigator|fetch\s*\(/)
  assert.match(media, /useSyncExternalStore/)
  await absent('../hooks/useMediaQuery.js')
  await absent('../utils/formFormatting.js')
})

test('frontend shared modules do not import domain ownership', async () => {
  for (const name of uiOwners) {
    const source = await read(`./ui/${name}`)
    assert.doesNotMatch(source, /domains\//, name)
  }
  assert.doesNotMatch(await read('./hooks/useMediaQuery.js'), /domains\//)
  assert.doesNotMatch(await read('./utils/formFormatting.js'), /domains\//)
})
