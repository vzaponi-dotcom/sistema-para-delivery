export const formatPhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const formatBRLNumber = (value) => Number(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatBRLCurrencyInput = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return `R$ ${formatBRLNumber(Number(digits) / 100)}`
}

export const formatBRLCurrencyValue = (value) => {
  const number = Number(value)
  const safeValue = Number.isFinite(number) && number >= 0 ? number : 0
  return `R$ ${formatBRLNumber(safeValue)}`
}

export const parseBRLCurrencyInput = (value) => {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? number : 0
}
