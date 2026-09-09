const ORIGIN_ORDER_IDS_STORAGE_KEY = 'printing-origin-order-ids'

const isAwaitingSecondCopy = (job) => job?.status === 'awaiting_second_copy'
  && Number(job?.copiesRequested) === 2
  && Number(job?.copiesPrinted) === 1

const isActiveOrder = (order) => !['Finalizado', 'Cancelado'].includes(order?.status)

export const acknowledgeAndOpenSecondCopyPrompt = async ({ job, acknowledge, openPrompt }) => {
  const result = await acknowledge(job)
  if (result?.promptPresented) openPrompt(job.id)
  return result
}

export const findOriginSecondCopyPrompt = ({
  jobs = [],
  orders = [],
  originOrderIds = new Set(),
  dismissedJobIds = new Set(),
}) => jobs.find((job) => (
  !dismissedJobIds.has(job?.id)
  && originOrderIds.has(job?.orderId)
  && isAwaitingSecondCopy(job)
  && isActiveOrder(orders.find((order) => order.id === job.orderId))
)) ?? null

export const readOriginOrderIds = (storage) => {
  try {
    const values = JSON.parse(storage?.getItem(ORIGIN_ORDER_IDS_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(values) ? values.filter((id) => typeof id === 'string' && id) : [])
  } catch {
    return new Set()
  }
}

export const rememberOriginOrderId = (orderId, storage) => {
  const ids = readOriginOrderIds(storage)
  if (!orderId) return ids
  ids.add(orderId)
  try { storage?.setItem(ORIGIN_ORDER_IDS_STORAGE_KEY, JSON.stringify([...ids])) } catch { /* optional browser storage */ }
  return ids
}
