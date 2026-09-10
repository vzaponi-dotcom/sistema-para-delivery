const locks = new WeakMap()

// Each mounted overlay owns one token. Capture overflow only for the first
// owner, and restore it only after the last release, regardless of teardown order.
export function acquireBodyScrollLock(body) {
  let lock = locks.get(body)
  if (!lock) {
    lock = { overflow: body.style.overflow, owners: new Set() }
    locks.set(body, lock)
    body.style.overflow = 'hidden'
  }
  const token = {}
  lock.owners.add(token)
  return () => {
    if (!lock.owners.delete(token)) return
    if (!lock.owners.size) {
      body.style.overflow = lock.overflow
      locks.delete(body)
    }
  }
}
