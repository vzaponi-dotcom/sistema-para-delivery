const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
const date = (value) => value ? String(value).split('-').reverse().join('/') : 'Indisponível'
const generated = (value) => value ? new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
}).format(new Date(value)) : 'Indisponível'

const FILTER_LABELS = {
  type: 'Modalidade', paymentMethod: 'Forma de pagamento', status: 'Status',
  schedule: 'Agendamento', category: 'Categoria', product: 'Produto',
  customer: 'Cliente', search: 'Busca', operationalDeadline: 'Prazo operacional',
  orderHourFrom: 'Hora inicial', orderHourTo: 'Hora final', receivable: 'A receber',
}
const SKIP_FILTERS = new Set(['view', 'from', 'to', 'period', 'page', 'pageSize', 'sort'])
const KPI = {
  overview: [
    ['salesCents', 'Vendas registradas', 'money'], ['ordersCount', 'Pedidos', 'number'],
    ['averageTicketCents', 'Ticket médio', 'money'], ['receivedCents', 'Recebido no período', 'money'],
    ['receivableCents', 'A receber', 'money'], ['cancellationRate', 'Taxa de cancelamento', 'percent'],
    ['refundsCents', 'Estornos', 'money'], ['withinDeadlineRate', 'Dentro do prazo', 'percent'],
  ],
  operation: [
    ['operationalOrdersCount', 'Pedidos operacionais', 'number'],
    ['averageDurationMinutes', 'Tempo médio', 'minutes'], ['medianDurationMinutes', 'Mediana', 'minutes'],
    ['p90DurationMinutes', 'P90', 'minutes'], ['withinDeadlineRate', 'Dentro do prazo', 'percent'],
    ['averageLateMinutes', 'Atraso médio', 'minutes'],
    ['scheduledPunctualityRate', 'Pontualidade agendada', 'percent'],
  ],
  sales: [
    ['salesCents', 'Vendas registradas', 'money'], ['ordersCount', 'Pedidos', 'number'],
    ['averageTicketCents', 'Ticket médio', 'money'], ['receivedCents', 'Recebido no período', 'money'],
    ['merchandiseRevenueCents', 'Receita de mercadoria', 'money'],
    ['deliveryFeesCents', 'Taxas de entrega', 'money'], ['receivableCents', 'A receber', 'money'],
    ['refundsCents', 'Estornos', 'money'],
  ],
  products: [
    ['unitsSold', 'Unidades vendidas', 'number'], ['mealsSold', 'Refeições vendidas', 'number'],
    ['merchandiseRevenueCents', 'Receita de mercadoria', 'money'],
  ],
  detail: [
    ['ordersCount', 'Pedidos no período', 'number'], ['salesCents', 'Faturamento total', 'money'],
    ['averageTicketCents', 'Ticket médio', 'money'], ['cancellationRate', 'Taxa de cancelamento', 'percent'],
  ],
}
const format = (value, kind) => value == null ? 'Indisponível'
  : kind === 'money' ? money(value)
    : kind === 'percent' ? `${number(value)}%`
      : kind === 'minutes' ? `${number(value)} min`
        : number(value)

export function buildPdfExecutiveSections(model = {}) {
  const summary = model.summary || model.metrics || {}
  const metrics = summary.metrics || summary.summary || summary
  const sections = [{ heading: 'Centro de Relatórios', lines: [
    `Gerado em: ${generated(model.generatedAt)}`,
    `Período: ${date(model.period?.from)} a ${date(model.period?.to)}`,
    'Fuso horário: America/Sao_Paulo',
  ] }]
  const filters = Object.entries(model.filters || {}).filter(([key, value]) => !SKIP_FILTERS.has(key) && value != null && value !== '')
  sections.push({ heading: 'Filtros aplicados', lines: filters.length
    ? filters.map(([key, value]) => `${FILTER_LABELS[key] || key}: ${value}`)
    : ['Nenhum filtro adicional.'] })
  const definitions = KPI[model.view] || []
  const indicators = definitions.filter(([key]) => Object.hasOwn(metrics, key))
    .map(([key, label, kind]) => `${label}: ${format(metrics[key], kind)}`)
  if (!indicators.length) indicators.push(...Object.entries(metrics)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string' || value == null)
    .slice(0, 12).map(([key, value]) => `${key}: ${value ?? 'Indisponível'}`))
  sections.push({ heading: 'Indicadores principais', lines: indicators.length ? indicators : ['Sem indicadores para o recorte.'] })

  const comparisonMetrics = model.comparison?.metrics || {}
  const comparisonLines = definitions.flatMap(([key, label, kind]) => {
    const comparison = comparisonMetrics[key]
    if (!comparison) return []
    if (!comparison.available || comparison.percent == null) return [`${label}: Sem base comparável`]
    const sign = comparison.percent > 0 ? '+' : ''
    return [`${label}: ${sign}${number(comparison.percent)}% vs. período anterior · anterior ${format(comparison.previous, kind)}`]
  })
  if (comparisonLines.length) sections.push({ heading: 'Comparação com período anterior', lines: comparisonLines })

  if (model.view === 'operation') {
    sections.push({ heading: 'Volume por modalidade', lines: (summary.byModality || []).map((item) => `${item.type}: ${number(item.count)} pedidos · tempo médio ${format(item.averageDurationMinutes, 'minutes')}`) })
    sections.push({ heading: 'Faixas de duração', lines: (summary.durationBands || []).map((item) => `${item.label}: ${number(item.count)} pedidos`) })
  } else if (model.view === 'sales') {
    sections.push({ heading: 'Mix por forma de pagamento', lines: (summary.paymentMix || []).map((item) => `${item.method}: ${money(item.amountCents)}`) })
    sections.push({ heading: 'Vendas por dia', lines: (summary.salesSeries || []).slice(-10).map((item) => `${date(item.date)}: ${money(item.cents)}`) })
  } else if (model.view === 'products') {
    sections.push({ heading: 'Top 10 produtos', lines: (summary.top10 || []).map((item) => `${item.name}: ${number(item.quantity)} un. · ${money(item.revenueCents)}`) })
    sections.push({ heading: 'Receita por categoria', lines: (summary.categories || []).slice(0, 8).map((item) => `${item.category || 'Sem categoria'}: ${money(item.revenueCents)}`) })
  } else if (model.view === 'detail') {
    sections.push({ heading: 'Pedidos detalhados', lines: [`${number(model.rowCount ?? summary.total ?? 0)} pedidos no recorte. A listagem completa está disponível em CSV ou XLSX.`] })
  }
  const quality = model.quality?.operation || model.quality || {}
  const coverage = []
  if (quality.eligibleCount != null) coverage.push(`Amostra medida: ${number(quality.measuredCount ?? 0)} de ${number(quality.eligibleCount)} elegíveis.`)
  if (quality.invalidCount) coverage.push(`Registros sem tempo válido: ${number(quality.invalidCount)}.`)
  if (quality.invalidAllocationOrderCount) coverage.push(`Pedidos sem alocação válida: ${number(quality.invalidAllocationOrderCount)}.`)
  coverage.push(...(model.warnings || []))
  if (coverage.length) sections.push({ heading: 'Qualidade e observações', lines: coverage })
  return sections.filter((section) => section.lines.length)
}

export async function createPdfSummary(model = {}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  let y = 18
  for (const section of buildPdfExecutiveSections(model)) {
    if (y > 260) { pdf.addPage(); y = 18 }
    pdf.setFontSize(13)
    pdf.text(section.heading, 14, y)
    y += 8
    pdf.setFontSize(10)
    for (const line of section.lines) {
      for (const wrapped of pdf.splitTextToSize(line, 180)) {
        if (y > 277) { pdf.addPage(); y = 18 }
        pdf.text(wrapped, 14, y)
        y += 6
      }
    }
    y += 5
  }
  return pdf
}
