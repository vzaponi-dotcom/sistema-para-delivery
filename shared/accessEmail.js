const invalid = () => Object.assign(new Error('Informe um e-mail válido.'), { code: 'INVALID_EMAIL', status: 400 })

// ASCII dot-atom addresses. Do not merge different mailboxes by stripping aliases.
export function normalizeAccessEmail(input) {
  if (typeof input !== 'string' || /[^\x20-\x7e]/.test(input)) throw invalid()
  const email = input.trim().toLowerCase()
  if (email.length > 254) throw invalid()
  const parts = email.split('@')
  if (parts.length !== 2) throw invalid()
  const [local, domain] = parts
  if (!local || local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)) throw invalid()
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    || !/^[a-z]{2,63}$/.test(labels.at(-1))) throw invalid()
  return email
}
