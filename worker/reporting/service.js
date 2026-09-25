export const createReportingService = () => Object.freeze({
  async empty(_businessId, _query) {
    return { data: {}, quality: {} }
  },
})
