export const orderTables = (tables = []) => [...tables].sort(
  (left, right) => Number(left?.sortOrder ?? 0) - Number(right?.sortOrder ?? 0),
)

export const isActiveTable = (table) => Boolean(table?.isActive)

export const isOccupiedTable = (table) => Boolean(
  table?.isActive
  && table?.occupancy === 'occupied'
  && table?.openTableTab?.id,
)

export const isFreeTable = (table) => Boolean(
  table?.isActive
  && table?.occupancy === 'free',
)

export const getActiveTables = (tables = []) => orderTables(tables).filter(isActiveTable)
