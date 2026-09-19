const isAwaitingSecondCopy = (job) => job?.status === 'awaiting_second_copy'
  && Number(job?.copiesRequested) === 2
  && Number(job?.copiesPrinted) === 1
const isActiveOrder = (order) => !['Finalizado', 'Cancelado'].includes(order?.status)

export const isSecondCopyPromptEligible = (job, order) => isAwaitingSecondCopy(job)
  && (job?.type === 'table-tab' || (job?.type === 'order' && Boolean(order) && isActiveOrder(order)))

export const getSecondCopyPromptTitle = (job, order) => {
  if (job?.type === 'table-tab') {
    const number = Number(job?.document?.tableTab?.number)
    return Number.isInteger(number) && number > 0 ? `Comanda #${number}` : 'Comanda'
  }
  const number = Number(order?.orderNumber)
  return Number.isInteger(number) && number > 0 ? `Pedido #${number}` : 'Pedido'
}

export const acknowledgeAndOpenSecondCopyPrompt = async ({ job, acknowledge, openPrompt, reopenAcknowledged = false }) => {
  const result = await acknowledge(job)
  if (result?.promptPresented || reopenAcknowledged) openPrompt(job.id)
  return result
}

export const findOriginSecondCopyPrompt = ({
  jobs = [], orders = [], originOrderIds = new Set(), dismissedJobIds = new Set(),
}) => jobs.find((job) => (
  !dismissedJobIds.has(job?.id)
  && originOrderIds.has(job?.orderId)
  && isAwaitingSecondCopy(job)
  && isActiveOrder(orders.find((order) => order.id === job.orderId))
)) ?? null
