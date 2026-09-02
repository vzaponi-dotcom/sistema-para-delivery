export const normalizeClientName = (value) => String(value ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('pt-BR')

export const normalizeClientPhone = (value) => {
  let digits = String(value ?? '').replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  digits = digits.slice(0, 11)
  if (!digits || /^0+$/.test(digits)) return ''
  return digits
}

export const formatClientPhone = (value) => {
  const digits = normalizeClientPhone(value)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export const findClientDuplicates = (clients, draft, excludeId = null) => {
  const name = normalizeClientName(draft?.name)
  const phone = normalizeClientPhone(draft?.phone)
  const candidates = (Array.isArray(clients) ? clients : []).filter((client) => client?.id !== excludeId)

  return {
    name: name ? candidates.find((client) => normalizeClientName(client?.name) === name) ?? null : null,
    phone: phone ? candidates.find((client) => normalizeClientPhone(client?.phone) === phone) ?? null : null,
  }
}
