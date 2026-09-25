export async function createPdfSummary(model = {}) {
  const { title = 'Centro de Relatórios', generatedAt, period, filters = {}, quality = {}, warnings = [] } = model
  const metrics = model.summary?.metrics || model.summary || model.metrics || {}
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  pdf.text(title, 14, 18)
  pdf.text(`Gerado em: ${generatedAt || ''}`, 14, 28)
  if (period) pdf.text(`Período: ${period.from} a ${period.to}`, 14, 36)
  const activeFilters = Object.entries(filters).filter(([key, value]) => !['view', 'from', 'to', 'period', 'page', 'pageSize', 'sort'].includes(key) && value != null && value !== '')
  let y = period ? 45 : 38
  if (activeFilters.length) { pdf.text(`Filtros: ${activeFilters.map(([key, value]) => `${key}=${value}`).join(' · ')}`.slice(0, 105), 14, y); y += 10 }
  pdf.setFontSize(14)
  pdf.text('Indicadores principais', 14, y)
  pdf.setFontSize(10)
  y += 9
  for (const [label, value] of Object.entries(metrics).filter(([, value]) => typeof value === 'number' || value == null).slice(0, 12)) {
    pdf.text(`${label}: ${value == null ? 'Indisponível' : value}`, 14, y)
    y += 7
  }
  const summaries = [metrics.paymentMix, metrics.categories, metrics.byModality].find(Array.isArray) || []
  if (summaries.length && y < 235) {
    y += 5; pdf.setFontSize(14); pdf.text('Resumo do recorte', 14, y); pdf.setFontSize(10); y += 8
    for (const item of summaries.slice(0, 8)) { pdf.text(Object.values(item).slice(0, 3).join(' · ').slice(0, 100), 14, y); y += 7 }
  }
  if ((quality.invalidCount || warnings.length) && y < 260) {
    y += 6; pdf.text(`Cobertura: ${quality.measuredCount ?? '—'}/${quality.eligibleCount ?? '—'}`, 14, y); y += 7
    for (const warning of warnings.slice(0, 2)) { pdf.text(warning.slice(0, 100), 14, y); y += 7 }
  }
  return pdf
}
