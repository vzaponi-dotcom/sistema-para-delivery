import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('mobile summary is compact and has no payment mutation', async () => { const s = await readFile(new URL('./ReportingMobileSummary.jsx', import.meta.url), 'utf8'); assert.match(s, /Resumo do período/); assert.doesNotMatch(s, /Registrar pagamento/) })
