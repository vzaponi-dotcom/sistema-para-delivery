const validPageCount = (value) => (
  Number.isSafeInteger(value) && value >= 1 ? value : 1
)

const validRevision = (value) => (
  Number.isSafeInteger(value) && value >= 0 ? value : 0
)

const requestedPage = (control) => (
  Number.isSafeInteger(control?.requestedPage) && control.requestedPage >= 1
    ? control.requestedPage
    : 1
)

const clampPage = (page, pageCount) => Math.min(
  validPageCount(pageCount),
  Math.max(1, Number.isSafeInteger(page) ? page : 1),
)

export const createKitchenDisplayPagingState = (control) => ({
  currentPage: 1,
  appliedRevision: validRevision(control?.revision),
})

export const reconcileKitchenDisplayPaging = (
  state,
  { control, pageCount, hasArrivals = false },
) => {
  const current = {
    currentPage: clampPage(state?.currentPage, pageCount),
    appliedRevision: validRevision(state?.appliedRevision),
  }
  const revision = validRevision(control?.revision)

  if (hasArrivals) {
    return {
      currentPage: 1,
      appliedRevision: Math.max(current.appliedRevision, revision),
    }
  }

  if (revision > current.appliedRevision) {
    return {
      currentPage: clampPage(requestedPage(control), pageCount),
      appliedRevision: revision,
    }
  }

  return current
}
