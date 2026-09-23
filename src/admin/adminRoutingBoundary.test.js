import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

test('Task 7: main keeps Kitchen TV and admin as separate dynamic entry imports', async () => {
  const source = await read('src/main.jsx')

  assert.match(source, /window\.location\.pathname === ['"]\/cozinha-tv['"]/)
  assert.match(source, /await import\(['"]\.\/kitchen-display\/KitchenDisplayRoot\.jsx['"]\)/)
  assert.match(source, /await import\(['"]\.\/admin\/AdminBootstrap\.jsx['"]\)/)
  assert.doesNotMatch(source, /^import .*KitchenDisplayRoot/m)
  assert.doesNotMatch(source, /^import .*AdminBootstrap/m)
})

test('Task 7: admin and Kitchen TV roots do not statically cross-import each other', async () => {
  const [admin, kitchen] = await Promise.all([
    read('src/admin/AdminBootstrap.jsx'),
    read('src/kitchen-display/KitchenDisplayRoot.jsx'),
  ])

  assert.match(admin, /RouterProvider/)
  assert.match(admin, /createAdminBrowserRouter/)
  assert.doesNotMatch(admin, /KitchenDisplayRoot|kitchen-display/)

  assert.doesNotMatch(kitchen, /AdminBootstrap|adminRouter|react-router|\.\.\/App\.jsx/)
})

test('Task 7: Cloudflare preserves SPA fallback and runs Worker first only for API paths', async () => {
  const wrangler = JSON.parse(await read('wrangler.jsonc'))
  assert.equal(wrangler.assets?.not_found_handling, 'single-page-application')
  assert.deepEqual(wrangler.assets?.run_worker_first, ['/api/*'])

  const worker = await read('worker/index.js')
  assert.match(worker, /if \(url\.pathname\.startsWith\(['"]\/api\/['"]\)\) return await authenticatedApi/)
  assert.match(worker, /return env\.ASSETS\.fetch\(request\)/)
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\(['"]\/pedidos|url\.pathname === ['"]\/pedidos/)
})
