export function filterAndSortClients(clients, { search = '', sort = 'name-asc' } = {}) {
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = (Array.isArray(clients) ? clients : []).filter((client) => (
    !normalizedSearch
    || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch)
  ))

  return [...filtered].sort((a, b) => (
    sort === 'name-desc'
      ? b.name.localeCompare(a.name)
      : a.name.localeCompare(b.name)
  ))
}
