import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')
const readOptional = async (relativePath) => read(relativePath).catch(() => '')

test('desktop settings tables do not clip their three-dot action menus', async () => {
  const css = await readOptional('../settings-table-polish.css')
  const shell = await read('../components/SettingsEditorShell.jsx')

  assert.match(shell, /settings-table-polish\.css/)
  assert.match(css, /\.payment-settings-table[\s\S]*\.cancellation-settings-table[\s\S]*\.finance-category-table\s*\{[^}]*overflow:\s*visible;/s)
})

test('non-default payment methods leave the default column empty instead of rendering a dash', async () => {
  const source = await read('./PaymentSettings.jsx')
  assert.doesNotMatch(source, /payment-default-dash/)
  assert.doesNotMatch(source, />—<\/span>/)
})

test('payment methods use compact rows on desktop and compact cards on mobile without shrinking menu touch targets', async () => {
  const css = await readOptional('../settings-table-polish.css')
  const paymentCss = await read('../payment-settings.css')

  assert.match(css, /\.payment-settings-row\s*\{[^}]*min-height:\s*58px;[^}]*padding:\s*5px 18px;/s)
  assert.match(css, /\.payment-method-icon\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;/s)
  assert.match(paymentCss, /\.payment-actions-menu summary\s*\{[^}]*min-height:\s*44px;/s)

  const mobile820 = css.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n\}/)?.[1] || ''
  const mobile640 = css.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(mobile820, /\.payment-settings-row\s*\{[\s\S]*?min-height:\s*96px;[\s\S]*?padding:\s*10px 11px;/)
  assert.match(mobile640, /\.payment-settings-row\s*\{[\s\S]*?min-height:\s*92px;[\s\S]*?padding:\s*9px 9px;/)
})
