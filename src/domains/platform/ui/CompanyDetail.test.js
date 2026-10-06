import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'
import { companyStatus } from './companyStatus.js'
test('access and delivery are projected independently', () => {
  for (const [deliveryStatus, label] of [['pending', 'Envio em processamento'], ['accepted', 'Enviado ao serviço de e-mail'], ['rejected', 'Falha de envio'], ['uncertain', 'Envio não confirmado']]) {
    assert.deepEqual(companyStatus({ accessStatus: 'pending', invitation: { status: 'pending', deliveryStatus } }), { access: 'Aguardando ativação', invitation: label, activated: false })
  }
  assert.equal(companyStatus({ invitation: { status: 'expired', deliveryStatus: 'accepted' } }).invitation, 'Convite expirado')
})
test('failed resend holds scope guard until canonical detail has been read', async t => {
  const h = await workspaceHarness(t), { default: Screen } = await h.load('/src/domains/platform/ui/CompanyDetail.jsx')
  let reads = 0, resolveRead; const guards = []
  const company = { id: 'A', name: 'A', accessStatus: 'pending', invitation: { canResend: true, status: 'pending' } }
  const renderer = await h.render(Screen, { businessId: 'A', canResend: true, onPendingChange: value => guards.push(value), api: { getBusiness: async () => ++reads === 1 ? company : new Promise(resolve => { resolveRead = resolve }), resendFirstManagerInvitation: async () => { throw Object.assign(new Error(), { status: 429 }) } } })
  await act(async () => { void buttonNamed(renderer.root, 'Reenviar convite').props.onClick() })
  assert.match(nodeText(renderer.root), /60 segundos/)
  assert.deepEqual(guards, [true])
  await act(async () => { resolveRead(company) })
  assert.deepEqual(guards, [true, false])
})
test('activated company takes precedence over delivery failure and cannot resend initial invitation', async t => {
  const h = await workspaceHarness(t), { default: Detail } = await h.load('/src/domains/platform/ui/CompanyDetail.jsx')
  const renderer = await h.render(Detail, { businessId: 'A', canResend: true, api: { getBusiness: async () => ({ id: 'A', name: 'Cozinha A', accessStatus: 'active', firstManager: { name: 'Ana', email: 'ana@example.test' }, invitation: { status: 'accepted', deliveryStatus: 'rejected', canResend: true }, history: [] }), resendFirstManagerInvitation: () => assert.fail('activated resend') } })
  assert.match(nodeText(renderer.root), /Ativa/)
  assert.equal(buttonNamed(renderer.root, 'Reenviar convite'), undefined)
  assert.doesNotMatch(nodeText(renderer.root), /Falha de envio/)
})
