export const CUSTOMER_IDENTITY_TYPES = ['registered_client', 'guest_name', 'table']
export const TABLE_ID_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

const fail = (field, message) => ({ ok: false, field, message })

export const validateCustomerIdentity = (orderType, identity = {}) => {
  const type = identity.type
  if (!CUSTOMER_IDENTITY_TYPES.includes(type)) {
    return fail('customerIdentity.type', 'Identificação inválida.')
  }

  if (orderType !== 'Local' && type !== 'registered_client') {
    return fail('customerIdentity.type', 'Entrega e retirada exigem cliente cadastrado.')
  }

  if (type === 'registered_client') {
    const clientId = String(identity.clientId ?? '').trim()
    if (!clientId) return fail('customerIdentity.clientId', 'Selecione um cliente cadastrado.')
    return { ok: true, value: { type, clientId } }
  }

  if (orderType !== 'Local') {
    return fail('customerIdentity.type', 'Esta identificação só pode ser usada em consumo no local.')
  }

  const value = String(identity.value ?? '').trim()
  if (type === 'guest_name') {
    if (!value || value.length > 80) {
      return fail('customerIdentity.value', 'Informe um nome com até 80 caracteres.')
    }
    return { ok: true, value: { type, value } }
  }

  if (!value || value.length > 12 || !TABLE_ID_PATTERN.test(value)) {
    return fail('customerIdentity.value', 'Informe uma mesa válida com até 12 caracteres, usando letras, números ou hífen.')
  }
  return { ok: true, value: { type, value } }
}
