export const CUSTOMER_IDENTITY_TYPES = ['registered_client', 'guest_name', 'table']

const fail = (field, message) => ({ ok: false, field, message })

export const validateCustomerIdentity = (orderType, identity = {}) => {
  const type = identity.type
  if (!CUSTOMER_IDENTITY_TYPES.includes(type)) {
    return fail('customerIdentity.type', 'Identificação inválida.')
  }

  if (orderType !== 'Local' && type !== 'registered_client') {
    return fail('customerIdentity.type', 'Entrega e retirada exigem cliente cadastrado.')
  }

  if (orderType !== 'Local') {
    const clientId = String(identity.clientId ?? '').trim()
    if (!clientId) return fail('customerIdentity.clientId', 'Selecione um cliente cadastrado.')
    return { ok: true, value: { type: 'registered_client', clientId } }
  }

  if (type !== 'table') {
    return fail('customerIdentity.type', 'Consumo no local exige uma mesa cadastrada.')
  }

  const tableId = String(identity.tableId ?? '').trim()
  if (!tableId) return fail('customerIdentity.tableId', 'Selecione uma mesa.')

  const clientId = String(identity.clientId ?? '').trim()
  return {
    ok: true,
    value: {
      type: 'table',
      tableId,
      ...(clientId ? { clientId } : {}),
    },
  }
}
