import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('individual form defaults shared, preserves password, and explicitly opts into personal mode', async (t) => {
  const h = await workspaceHarness(t)
  const { default: LoginScreen } = await h.load('/src/app/shell/LoginScreen.jsx')
  const submissions = []
  const renderer = await h.render(LoginScreen, { authMode: 'user_only', onLogin: (value) => submissions.push(value) })
  await act(async () => {
    renderer.root.findByProps({ autoComplete: 'username' }).props.onChange({ target: { value: 'ana' } })
    renderer.root.findByProps({ autoComplete: 'current-password' }).props.onChange({ target: { value: ' password with spaces ' } })
  })
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(submissions[0], { identifier: 'ana', password: ' password with spaces ', deviceMode: 'shared' })
  assert.equal(renderer.root.findAllByProps({ placeholder: 'Digite o PIN' }).length, 0)
  await act(async () => {
    renderer.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } })
    renderer.root.findByProps({ autoComplete: 'current-password' }).props.onChange({ target: { value: 'new password' } })
  })
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(submissions[1].deviceMode, 'personal')
})
