import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('important success feedback uses a centered viewport confirmation while errors keep the top toast', async () => {
  const app = await read('./App.jsx')

  assert.match(app, /const \[successMessage, setSuccessMessage\] = useState\(''\)/)
  assert.match(app, /const showSuccessMessage = \(message = 'Ação salva com sucesso'\) => setSuccessMessage\(message\)/)
  assert.match(app, /setToastMessage\(error\?\.message \|\| 'Não foi possível concluir a operação\.'\)/)
  assert.match(app, /successMessage &&[\s\S]*success-confirmation-overlay[\s\S]*success-confirmation-card[\s\S]*document\.body/s)
  assert.match(app, /window\.setTimeout\(\(\) => setSuccessMessage\(''\), 1800\)/)
})

test('success confirmation is centered, blurs the page softly and stays compact on mobile', async () => {
  const css = await read('./success-feedback.css')
  const indexCss = await read('./index.css')

  assert.match(indexCss, /@import '\.\/success-feedback\.css'/)
  assert.match(css, /\.success-confirmation-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*display:\s*grid[^}]*place-items:\s*center[^}]*backdrop-filter:\s*blur\(4px\)/s)
  assert.match(css, /\.success-confirmation-card\s*\{[^}]*width:\s*min\(320px,\s*calc\(100vw\s*-\s*32px\)\)[^}]*min-height:\s*160px[^}]*max-height:\s*min\(240px,\s*calc\(100dvh\s*-\s*48px\)\)/s)
  assert.match(css, /\.success-confirmation-icon\s*\{[^}]*width:\s*56px[^}]*height:\s*56px/s)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*success-confirmation-card/s)
})
