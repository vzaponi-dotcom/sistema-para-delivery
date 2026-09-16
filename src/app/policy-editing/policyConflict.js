const MISSING = Symbol('missing')
const clone = (value) => value === MISSING ? MISSING : (value == null ? value : structuredClone(value))
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const same = (left, right) => {
  if (left === MISSING || right === MISSING) return left === right
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => same(value, right[index]))
  }
  if (!isObject(left) || !isObject(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return same(leftKeys, rightKeys) && leftKeys.every((key) => same(left[key], right[key]))
}

const unwrap = (value) => isObject(value) && Object.hasOwn(value, 'data') && Number.isSafeInteger(value.revision)
  ? { data: value.data, meta: value.meta || {}, revision: value.revision }
  : { data: value, meta: {}, revision: null }

const pathLabel = (segments) => segments.map((segment, index) => (
  typeof segment === 'object' ? `[${segment.id}]` : `${index ? '.' : ''}${segment}`
)).join('') || 'configura\u00e7\u00e3o'

const listWithIds = (values) => values.every((value) => isObject(value) && (typeof value.id === 'string' || typeof value.id === 'number'))
const itemMeta = (meta, listPath, id) => {
  let cursor = meta
  for (const segment of listPath) cursor = cursor?.[segment]
  const items = cursor?.items || (listPath.at(-1) === 'items' ? cursor : null)
  return items?.[id] || meta?.items?.[id] || {}
}

function createMerger({ baseMeta, currentMeta }) {
  const conflicts = []
  let conflictSequence = 0
  const conflict = ({ segments, kind = 'value', base, current, draft, choices = ['current', 'draft'], message, target }) => {
    const entry = {
      id: `policy-conflict-${++conflictSequence}`,
      path: pathLabel(segments),
      segments: clone(segments),
      kind,
      base: base === MISSING ? undefined : clone(base),
      current: current === MISSING ? undefined : clone(current),
      draft: draft === MISSING ? undefined : clone(draft),
      currentExists: current !== MISSING,
      draftExists: draft !== MISSING,
      choices,
      choice: choices.length === 1 ? choices[0] : null,
      message: message || 'O valor atual e o seu ajuste mudaram de formas diferentes.',
      target: clone(target || { type: 'value', segments }),
    }
    if (target?.itemId !== undefined) entry.itemId = target.itemId
    conflicts.push(entry)
    return clone(current)
  }

  const mergeValue = (base, draft, current, segments = []) => {
    if (same(draft, base)) return clone(current)
    if (same(draft, current)) return clone(draft)
    if ([base, draft, current].every(Array.isArray)) {
      if (listWithIds([...base, ...draft, ...current])) return mergeIdList(base, draft, current, segments)
      if (same(current, base)) return clone(draft)
      return conflict({ segments, kind: 'list', base, current, draft, message: 'A lista foi alterada nos dois locais.' })
    }
    if ([base, draft, current].every(isObject)) return mergeObject(base, draft, current, segments)
    if (same(current, base)) return clone(draft)
    return conflict({ segments, base, current, draft })
  }

  const mergeObject = (base, draft, current, segments) => {
    const result = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(draft), ...Object.keys(current)])
    for (const key of keys) {
      const baseValue = Object.hasOwn(base, key) ? base[key] : MISSING
      const draftValue = Object.hasOwn(draft, key) ? draft[key] : MISSING
      const currentValue = Object.hasOwn(current, key) ? current[key] : MISSING
      const merged = mergeValue(baseValue, draftValue, currentValue, [...segments, key])
      if (merged !== MISSING) result[key] = merged
    }
    return result
  }

  const mergeIdList = (base, draft, current, segments) => {
    const baseById = new Map(base.map((item) => [item.id, item]))
    const draftById = new Map(draft.map((item) => [item.id, item]))
    const currentById = new Map(current.map((item) => [item.id, item]))
    const mergedById = new Map()
    const allIds = new Set([...baseById.keys(), ...currentById.keys(), ...draftById.keys()])

    for (const id of allIds) {
      const baseItem = baseById.get(id) ?? MISSING
      const draftItem = draftById.get(id) ?? MISSING
      const currentItem = currentById.get(id) ?? MISSING
      if (baseItem === MISSING) {
        if (draftItem === MISSING) mergedById.set(id, clone(currentItem))
        else if (currentItem === MISSING || same(draftItem, currentItem)) mergedById.set(id, clone(draftItem))
        else mergedById.set(id, conflict({
          segments: [...segments, { id }], kind: 'add-add', base: MISSING, current: currentItem, draft: draftItem,
          target: { type: 'item', listSegments: segments, itemId: id },
        }))
        continue
      }

      const basePermissions = itemMeta(baseMeta, segments, id)
      const currentPermissions = itemMeta(currentMeta, segments, id)
      const protectedDelete = draftItem === MISSING && currentItem !== MISSING
        && (currentPermissions.isSystem === true || currentPermissions.usedEver === true || currentPermissions.canDelete === false)
      if (protectedDelete) {
        const changedNow = basePermissions.canDelete !== false && currentPermissions.canDelete === false
        mergedById.set(id, conflict({
          segments: [...segments, { id }], kind: 'protected-action', base: baseItem, current: currentItem, draft: MISSING,
          choices: ['current'],
          message: changedNow
            ? 'O estado atual do neg\u00f3cio mudou ap\u00f3s o primeiro uso. A refer\u00eancia hist\u00f3rica ser\u00e1 preservada e a exclus\u00e3o n\u00e3o est\u00e1 mais dispon\u00edvel.'
            : 'Este item \u00e9 protegido e sua refer\u00eancia hist\u00f3rica deve ser preservada.',
          target: { type: 'item', listSegments: segments, itemId: id },
        }))
        continue
      }
      if (draftItem === MISSING || currentItem === MISSING) {
        if (draftItem === MISSING && currentItem !== MISSING && same(currentItem, baseItem)) continue
        if (currentItem === MISSING && draftItem !== MISSING && same(draftItem, baseItem)) continue
        const candidate = conflict({
          segments: [...segments, { id }], kind: 'delete-edit', base: baseItem, current: currentItem, draft: draftItem,
          message: 'Um lado excluiu o item enquanto o outro o alterou.',
          target: { type: 'item', listSegments: segments, itemId: id },
        })
        if (candidate !== MISSING) mergedById.set(id, candidate)
        continue
      }

      const item = {}
      const keys = new Set([...Object.keys(baseItem), ...Object.keys(draftItem), ...Object.keys(currentItem)])
      for (const key of keys) {
        if (key === 'sortOrder') continue
        const localRename = key === 'label' && !same(draftItem[key], baseItem[key])
        const protectedRename = localRename
          && (currentPermissions.isSystem === true || currentPermissions.usedEver === true || currentPermissions.canRename === false)
        if (protectedRename) {
          const changedNow = basePermissions.canRename !== false && currentPermissions.canRename === false
          item[key] = conflict({
            segments: [...segments, { id }, key], kind: 'protected-action', base: baseItem[key], current: currentItem[key], draft: draftItem[key],
            choices: ['current'],
            message: changedNow
              ? 'O estado atual do neg\u00f3cio mudou ap\u00f3s o primeiro uso. O nome hist\u00f3rico ser\u00e1 preservado e a renomea\u00e7\u00e3o n\u00e3o est\u00e1 mais dispon\u00edvel.'
              : 'Este item \u00e9 protegido e n\u00e3o pode ser renomeado.',
            target: { type: 'value', segments: [...segments, { id }, key] },
          })
        } else {
          const baseField = Object.hasOwn(baseItem, key) ? baseItem[key] : MISSING
          const draftField = Object.hasOwn(draftItem, key) ? draftItem[key] : MISSING
          const currentField = Object.hasOwn(currentItem, key) ? currentItem[key] : MISSING
          const merged = mergeValue(baseField, draftField, currentField, [...segments, { id }, key])
          if (merged !== MISSING) item[key] = merged
        }
      }
      mergedById.set(id, item)
    }

    const baseOrder = base.map(({ id }) => id)
    const draftOrder = draft.map(({ id }) => id)
    const currentOrder = current.map(({ id }) => id)
    const orderChanged = (sideOrder) => {
      const shared = new Set(sideOrder.filter((id) => baseById.has(id)))
      const baseSharedOrder = baseOrder.filter((id) => shared.has(id))
      const sideSharedOrder = sideOrder.filter((id) => baseById.has(id))
      return !same(sideSharedOrder, baseSharedOrder) || sideOrder.some((id) => !baseById.has(id))
    }
    const localOrderChanged = orderChanged(draftOrder)
    const remoteOrderChanged = orderChanged(currentOrder)
    let selectedOrder = currentOrder
    if (localOrderChanged && !remoteOrderChanged) selectedOrder = draftOrder
    else if (localOrderChanged && remoteOrderChanged && same(draftOrder, currentOrder)) selectedOrder = draftOrder
    else if (localOrderChanged && remoteOrderChanged) {
      conflict({
        segments, kind: 'order', base: baseOrder, current: currentOrder, draft: draftOrder,
        message: 'A ordem da lista foi alterada nos dois locais.',
        target: { type: 'order', listSegments: segments },
      })
    }
    const orderedIds = [...selectedOrder, ...currentOrder, ...draftOrder, ...allIds]
      .filter((id, index, values) => values.indexOf(id) === index && mergedById.has(id))
    const result = orderedIds.map((id) => mergedById.get(id))
    if ([...base, ...draft, ...current].some((item) => Object.hasOwn(item, 'sortOrder'))) {
      return result.map((item, sortOrder) => ({ ...item, sortOrder }))
    }
    return result
  }

  return { mergeValue, conflicts }
}

const findList = (root, segments) => {
  let cursor = root
  for (const segment of segments) cursor = cursor?.[segment]
  return cursor
}

const applyListOrder = (list, order) => {
  const byId = new Map(list.map((item) => [item.id, item]))
  const ordered = [...order, ...list.map(({ id }) => id)]
    .filter((id, index, values) => values.indexOf(id) === index && byId.has(id))
    .map((id) => byId.get(id))
  list.splice(0, list.length, ...ordered)
}

const applyValue = (root, segments, value, exists) => {
  let cursor = root
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    cursor = typeof segment === 'object' ? cursor.find((item) => item.id === segment.id) : cursor[segment]
  }
  const last = segments.at(-1)
  if (exists) cursor[last] = clone(value)
  else delete cursor[last]
}

export function buildPolicyConflict({ base, draft, current } = {}) {
  const baseValue = unwrap(base)
  const currentValue = unwrap(current)
  const merger = createMerger({ baseMeta: baseValue.meta, currentMeta: currentValue.meta })
  const candidate = merger.mergeValue(baseValue.data, draft, currentValue.data)
  return {
    candidate,
    conflicts: merger.conflicts,
    current: clone(currentValue.data),
    draft: clone(draft),
    base: clone(baseValue.data),
    currentRevision: currentValue.revision,
  }
}

export function resolvePolicyConflict(review, choices = {}) {
  const candidate = clone(review.candidate)
  for (const conflict of review.conflicts) {
    const choice = choices[conflict.id] || conflict.choice
    if (!conflict.choices.includes(choice)) throw Object.assign(new Error(`Escolha pendente para ${conflict.path}.`), { code: 'SETTINGS_CONFLICT_UNRESOLVED' })
    const value = conflict[choice]
    const exists = conflict[`${choice}Exists`]
    const target = conflict.target
    if (target.type === 'value') applyValue(candidate, target.segments, value, exists)
    else if (target.type === 'item') {
      const list = findList(candidate, target.listSegments)
      const index = list.findIndex((item) => item.id === target.itemId)
      if (!exists && index >= 0) list.splice(index, 1)
      else if (exists && index >= 0) list[index] = clone(value)
      else if (exists) {
        list.push(clone(value))
        applyListOrder(list, findList(review[choice], target.listSegments).map(({ id }) => id))
      }
    } else if (target.type === 'order') {
      const list = findList(candidate, target.listSegments)
      applyListOrder(list, value)
    }
  }
  const normalizeOrder = (value) => {
    if (Array.isArray(value)) {
      const normalized = value.map(normalizeOrder)
      return normalized.some((item) => isObject(item) && Object.hasOwn(item, 'sortOrder'))
        ? normalized.map((item, sortOrder) => ({ ...item, sortOrder }))
        : normalized
    }
    if (!isObject(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeOrder(child)]))
  }
  return normalizeOrder(candidate)
}
