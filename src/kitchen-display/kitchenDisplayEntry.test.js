import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { workspaceHarness } from '../test-support/renderWorkspace.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('main selects the Kitchen TV bundle before loading the administrative app', async () => {
  const main = await read('../main.jsx')
  assert.doesNotMatch(main, /import\s+App\s+from\s+['"]\.\/App\.jsx['"]/)
  assert.match(main, /window\.location\.pathname\s*===\s*['"]\/cozinha-tv['"]/)
  assert.match(main, /import\(['"]\.\/kitchen-display\/kitchenDisplayLegacyCompat\.js['"]\)/)
  assert.match(main, /import\(['"]\.\/kitchen-display\/KitchenDisplayRoot\.jsx['"]\)/)
  assert.ok(main.indexOf('kitchenDisplayLegacyCompat.js') < main.indexOf('KitchenDisplayRoot.jsx'))
  assert.match(main, /const bootstrap = async \(\) =>/)
  assert.match(main, /import\(['"]\.\/admin\/AdminBootstrap\.jsx['"]\)/)
})

test('Kitchen TV root is independent from admin theme, bootstrap and printing stacks', async (t) => {
  const root = await read('./KitchenDisplayRoot.jsx')
  assert.doesNotMatch(root, /from\s+['"][^'"]*\/App\.jsx|ThemeProvider|\/api\/bootstrap|qz-tray|jspdf|printing/i)
  assert.match(root, /kitchen-display\.css/)
  assert.match(root, /KitchenDisplayErrorBoundary/)

  const h = await workspaceHarness(t)
  const { KitchenDisplayRoot } = await h.load('/src/kitchen-display/KitchenDisplayRoot.jsx')
  assert.equal(typeof KitchenDisplayRoot, 'function')
})
