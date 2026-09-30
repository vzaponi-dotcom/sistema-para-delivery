export const reservationOwnerKey = (selection) => String(selection?.reservationId || '').trim()

export const matchesReservationDetail = (reservationId, payload) => (
  Boolean(reservationId)
  && payload?.reservation?.id === reservationId
  && (!payload?.order?.tableReservationId || payload.order.tableReservationId === reservationId)
)

export const reservationMutationNeedsDiscount = (payload) => (
  ['discount', 'surcharge'].includes(payload?.adjustment?.type)
)
