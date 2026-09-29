export function useTableReservationCommands() {
  return {
    actionKey: null,
    pending: false,
    editReservation: async () => false,
    confirmArrival: async () => false,
    cancelReservation: async () => false,
    markNoShow: async () => false,
  }
}
