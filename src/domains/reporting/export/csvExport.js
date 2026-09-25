const escape = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function exportCsv({ columns = [], rows = [] }) {
  return `\uFEFF${[columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`
}
