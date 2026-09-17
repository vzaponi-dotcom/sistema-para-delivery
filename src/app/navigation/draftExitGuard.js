export const shouldConfirmDraftExit = (draft, activeDestination, nextDestination) => Boolean(
  draft?.dirty === true
  && !['saving', 'unconfirmed'].includes(draft.status)
  && draft.destinations instanceof Set
  && draft.destinations.has(activeDestination)
  && !draft.destinations.has(nextDestination),
)
