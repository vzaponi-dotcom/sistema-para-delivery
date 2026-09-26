import { REPORTING_EXPORT_FILTER_LABELS, formatReportingExportFilterValue } from './reportingExportPresentation.js'
import { EXECUTIVE_COVER_FOOD, MESIVA_REPORTING_LOGO } from './pdfExecutiveAssets.js'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100)
const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value || 0))
const date = (value) => value ? String(value).split('-').reverse().join('/') : 'Indisponível'
const generated = (value) => value ? new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
}).format(new Date(value)) : 'Indisponível'

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
    ...(model.operation?.name ? [`Operação: ${model.operation.name}`] : []),
    `Gerado em: ${generated(model.generatedAt)}`,
    `Período: ${date(model.period?.from)} a ${date(model.period?.to)}`,
    'Fuso horário: America/Sao_Paulo',
  ] }]
  const filters = Object.entries(model.filters || {}).filter(([key, value]) => !SKIP_FILTERS.has(key) && value != null && value !== '')
  sections.push({ heading: 'Filtros aplicados', lines: filters.length
    ? filters.map(([key, value]) => `${REPORTING_EXPORT_FILTER_LABELS[key] || key}: ${formatReportingExportFilterValue(key, value)}`)
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

const COLORS = Object.freeze({
  navy: [15, 39, 71],
  teal: [20, 184, 166],
  tealSoft: [104, 212, 197],
  mint: [223, 247, 241],
  yellow: [251, 191, 36],
  cloud: [248, 250, 252],
  white: [255, 255, 255],
  blue: [84, 166, 228],
  blueSoft: [145, 207, 240],
  danger: [239, 91, 102],
  muted: [101, 121, 148],
  border: [220, 230, 237],
  borderSoft: [235, 241, 245],
  cyanDark: [41, 125, 156],
  cyanPale: [156, 202, 211],
})

const formatPercent = (value) => value == null || !Number.isFinite(Number(value)) ? 'Indisponível' : `${number(value)}%`
const finite = (value) => Number.isFinite(Number(value))
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const soften = (color, amount = 0.78) => color.map((channel) => Math.round(channel + (255 - channel) * amount))

const activeFilters = (filters = {}) => Object.entries(filters)
  .filter(([key, value]) => !SKIP_FILTERS.has(key) && value != null && value !== '')
  .map(([key, value]) => `${REPORTING_EXPORT_FILTER_LABELS[key] || key}: ${formatReportingExportFilterValue(key, value)}`)

const comparisonValue = (comparison, kind = 'percent') => {
  if (!comparison) return { text: 'Sem base comparável', tone: 'neutral', magnitude: 0 }
  const raw = kind === 'points' ? comparison.delta : comparison.percent
  if (!comparison.available || !finite(raw)) return { text: 'Sem base comparável', tone: 'neutral', magnitude: 0 }
  const value = Number(raw)
  const sign = value > 0 ? '+' : ''
  const suffix = kind === 'points' ? ' p.p.' : '%'
  const direction = comparison.direction || 'neutral'
  const favorable = direction === 'lower_better' ? value < 0 : direction === 'higher_better' ? value > 0 : null
  return {
    text: `${sign}${number(value)}${suffix}`,
    tone: favorable === true ? 'success' : favorable === false ? 'danger' : value < 0 ? 'danger' : value > 0 ? 'success' : 'neutral',
    magnitude: Math.abs(value),
  }
}

const normalizeCategoryMix = (categories = [], totalCents = null) => {
  const total = finite(totalCents) && Number(totalCents) > 0
    ? Number(totalCents)
    : categories.reduce((sum, item) => sum + Number(item?.revenueCents || 0), 0)
  const normalized = categories
    .map((item) => ({
      label: item?.category || 'Sem categoria',
      revenueCents: Number(item?.revenueCents || 0),
    }))
    .filter((item) => item.revenueCents > 0)
    .sort((left, right) => right.revenueCents - left.revenueCents)
  const primary = normalized.slice(0, 5)
  const remainder = normalized.slice(5).reduce((sum, item) => sum + item.revenueCents, 0)
  if (remainder > 0) primary.push({ label: 'Outros', revenueCents: remainder })
  return primary.map((item) => ({
    ...item,
    sharePercent: total > 0 ? Number((item.revenueCents * 100 / total).toFixed(2)) : 0,
  }))
}

const buildInsights = ({ metrics, comparisons }) => {
  const sales = comparisonValue(comparisons.salesCents)
  const ticket = comparisonValue(comparisons.averageTicketCents)
  const cancellation = comparisonValue(comparisons.cancellationRate, 'points')
  const salesVerb = sales.text.startsWith('-') ? 'recuo' : sales.text === 'Sem base comparável' ? 'resultado atual' : 'crescimento'
  const ticketVerb = ticket.text.startsWith('-') ? 'redução' : ticket.text === 'Sem base comparável' ? 'nível atual' : 'crescimento'
  const cancellationText = cancellation.text === 'Sem base comparável'
    ? `Cancelamentos: taxa de ${formatPercent(metrics.cancellationRate)} no período; acompanhe a evolução quando houver base comparável.`
    : `${Number(comparisons.cancellationRate?.delta) <= 0 ? 'Cancelamentos em queda' : 'Cancelamentos em alta'}: variação de ${cancellation.text} frente ao período anterior.`
  return [
    sales.text === 'Sem base comparável'
      ? `Vendas registradas: ${money(metrics.salesCents)} no período; não há base comparável para medir a variação.`
      : `Vendas em ${salesVerb}: variação de ${sales.text} nas vendas registradas em relação ao período anterior.`,
    ticket.text === 'Sem base comparável'
      ? `Ticket médio: ${money(metrics.averageTicketCents)} por pedido no período selecionado.`
      : `Ticket médio: ${ticketVerb} de ${ticket.text} frente ao período anterior.`,
    cancellationText,
  ]
}

const buildObservations = ({ metrics, comparisons, operation, categories }) => {
  const cancellation = comparisonValue(comparisons.cancellationRate, 'points')
  const cancellationNote = cancellation.text === 'Sem base comparável'
    ? `A taxa de cancelamento foi de ${formatPercent(metrics.cancellationRate)} no período selecionado.`
    : `A taxa de cancelamento foi de ${formatPercent(metrics.cancellationRate)}, ${Number(comparisons.cancellationRate?.delta) <= 0 ? 'abaixo' : 'acima'} do período anterior em ${number(Math.abs(Number(comparisons.cancellationRate?.delta || 0)))} p.p.`
  const lateRate = finite(operation.withinDeadlineRate) ? Math.max(0, 100 - Number(operation.withinDeadlineRate)) : null
  const deadlineNote = lateRate == null
    ? 'A cobertura de prazo operacional não está disponível para este recorte.'
    : `${formatPercent(lateRate)} dos pedidos medidos ficaram fora do prazo operacional.`
  const lead = categories[0]
  const opportunity = lead
    ? `${lead.label} representa ${formatPercent(lead.sharePercent)} da receita de mercadoria. Considere ofertas e combos para aumentar o ticket médio.`
    : 'Use o ranking de produtos para identificar itens de maior participação e oportunidades de composição de ofertas.'
  return [
    { title: 'Cancelamentos', text: cancellationNote, kind: 'danger' },
    { title: 'Pedidos em atraso', text: deadlineNote, kind: 'blue' },
    { title: 'Oportunidades', text: opportunity, kind: 'teal' },
  ]
}

export function buildExecutivePdfViewModel(model = {}) {
  const executive = model.executive || {}
  const overviewResult = executive.overview || {}
  const operationResult = executive.operation || {}
  const productsResult = executive.products || {}
  const fallbackSummary = model.summary || {}
  const metrics = overviewResult.data?.metrics
    || fallbackSummary.metrics
    || fallbackSummary.summary
    || fallbackSummary
    || {}
  const comparisons = overviewResult.comparison?.metrics || model.comparison?.metrics || {}
  const operation = operationResult.data || {}
  const products = productsResult.data || {}
  const categories = normalizeCategoryMix(products.categories || [], products.merchandiseRevenueCents)
  const modalities = (executive.modalities || []).slice(0, 4).map((item) => ({
    label: item.label || item.type || 'Não informado',
    revenueCents: Number(item.revenueCents || 0),
    sharePercent: Number(item.sharePercent || 0),
  }))
  const topProducts = (products.top10 || products.ranking || []).slice(0, 5).map((item, index) => ({
    rank: index + 1,
    name: item.name || 'Produto',
    quantity: Number(item.quantity || 0),
    revenueCents: Number(item.revenueCents || 0),
    sharePercent: finite(item.sharePercent) ? Number(item.sharePercent) : 0,
  }))
  const received = Number(metrics.receivedCents || 0)
  const receivable = Number(metrics.receivableCents || 0)
  const financeTotal = received + receivable
  const receivedShare = financeTotal > 0 ? received * 100 / financeTotal : 0
  const filterLabels = activeFilters(model.filters || {})
  const generatedLabel = generated(model.generatedAt)
  const comparisonCards = [
    { label: 'Vendas registradas', ...comparisonValue(comparisons.salesCents) },
    { label: 'Pedidos', ...comparisonValue(comparisons.ordersCount) },
    { label: 'Ticket médio', ...comparisonValue(comparisons.averageTicketCents) },
    { label: 'Cancelamento', ...comparisonValue(comparisons.cancellationRate, 'points') },
  ]
  return {
    operationName: model.operation?.name || 'Operação',
    periodLabel: `${date(model.period?.from)} a ${date(model.period?.to)}`,
    generatedLabel,
    filtersLabel: filterLabels.length ? `Filtros: ${filterLabels.join(' · ')}` : '',
    metrics: {
      salesCents: Number(metrics.salesCents || 0),
      ordersCount: Number(metrics.ordersCount || 0),
      averageTicketCents: metrics.averageTicketCents == null ? null : Number(metrics.averageTicketCents),
      receivedCents: received,
      receivableCents: receivable,
      cancellationRate: metrics.cancellationRate == null ? null : Number(metrics.cancellationRate),
    },
    comparisons,
    comparisonCards,
    receivedShare,
    receivableShare: financeTotal > 0 ? receivable * 100 / financeTotal : 0,
    insights: buildInsights({ metrics, comparisons }),
    merchandiseRevenueCents: Number(products.merchandiseRevenueCents || 0),
    categories,
    modalities,
    topProducts,
    observations: buildObservations({ metrics, comparisons, operation, categories }),
    operationQuality: operationResult.quality || {},
  }
}

const setFill = (pdf, color) => pdf.setFillColor(...color)
const setStroke = (pdf, color) => pdf.setDrawColor(...color)
const setText = (pdf, color) => pdf.setTextColor(...color)

const text = (pdf, value, x, y, size = 8, color = COLORS.navy, { bold = false, align = 'left', maxWidth = null } = {}) => {
  pdf.setFont('helvetica', bold ? 'bold' : 'normal')
  pdf.setFontSize(size)
  setText(pdf, color)
  if (maxWidth) {
    const lines = pdf.splitTextToSize(String(value), maxWidth)
    pdf.text(lines, x, y, { align })
    return lines.length
  }
  pdf.text(String(value), x, y, { align })
  return 1
}

const roundedPanel = (pdf, x, y, w, h, { fill = COLORS.white, stroke = COLORS.border, radius = 3 } = {}) => {
  setFill(pdf, fill)
  setStroke(pdf, stroke)
  pdf.setLineWidth(0.24)
  pdf.roundedRect(x, y, w, h, radius, radius, 'FD')
}

const elevatedPanel = (pdf, x, y, w, h, { radius = 3, fill = COLORS.white } = {}) => {
  setFill(pdf, [246, 249, 251])
  pdf.roundedRect(x, y + 0.7, w, h, radius, radius, 'F')
  roundedPanel(pdf, x, y, w, h, { fill, stroke: COLORS.borderSoft, radius })
}

const drawBrandHeader = (pdf, { growthCallout = false } = {}) => {
  pdf.addImage(MESIVA_REPORTING_LOGO, 'PNG', 10, 7.2, 70.5, 24.7)
  setStroke(pdf, [138, 164, 190])
  pdf.setLineWidth(0.4)
  const dividerX = growthCallout ? 150.2 : 153
  pdf.line(dividerX, 9.3, dividerX, 28.1)
  if (growthCallout) {
    text(pdf, 'Gestão Delivery', 155.3, 16.4, 7.9, COLORS.navy, { bold: true })
    text(pdf, 'Restaurantes que vão mais longe', 155.3, 21.5, 4.35, COLORS.muted)
    roundedPanel(pdf, 181.6, 8.6, 22.0, 19.6, { fill: COLORS.mint, stroke: COLORS.mint, radius: 4 })
    text(pdf, 'Dados que', 184.5, 14.7, 5.15, COLORS.navy, { bold: true })
    text(pdf, 'alimentam', 184.5, 19.5, 5.15, COLORS.navy, { bold: true })
    text(pdf, 'o seu crescimento.', 184.5, 24.4, 4.65, COLORS.navy, { bold: true })
    setStroke(pdf, COLORS.yellow)
    pdf.setLineWidth(1.15)
    pdf.line(202.8, 10.1, 204.8, 6.8)
    pdf.line(204.0, 13.8, 207.4, 12.6)
  } else {
    text(pdf, 'Gestão Delivery', 159, 17.0, 9.7, COLORS.navy, { bold: true })
    text(pdf, 'Restaurantes que vão mais longe', 159, 22.5, 5.35, COLORS.muted)
  }
}

const drawFooter = (pdf, vm, page) => {
  text(pdf, 'Mesiva', 10, 290.5, 8.3, COLORS.navy, { bold: true })
  text(pdf, '|   PEOPLE  FOOD  PROGRESS', 29.5, 290.5, 5.7, [89, 116, 157])
  text(pdf, `Relatório executivo   ·   ${vm.periodLabel}   |   ${page}`, 200, 290.5, 5.55, COLORS.muted, { align: 'right' })
}

const drawInfoItem = (pdf, x, y, title, value, icon = 'store') => {
  drawMiniIcon(pdf, icon, x, y + 0.4, COLORS.teal)
  text(pdf, title, x + 9, y + 1.9, 6.2, COLORS.muted)
  text(pdf, value, x + 9, y + 7.8, 8.35, COLORS.navy, { bold: true })
}

const drawMiniIcon = (pdf, icon, x, y, color) => {
  setStroke(pdf, color)
  setFill(pdf, color)
  pdf.setLineWidth(0.62)
  if (icon === 'calendar') {
    pdf.roundedRect(x, y, 5.5, 5.5, 0.65, 0.65, 'S')
    pdf.line(x + 1.2, y - 0.8, x + 1.2, y + 1.1)
    pdf.line(x + 4.2, y - 0.8, x + 4.2, y + 1.1)
    pdf.line(x, y + 1.8, x + 5.5, y + 1.8)
    return
  }
  if (icon === 'document') {
    pdf.roundedRect(x + 0.4, y, 4.4, 5.6, 0.45, 0.45, 'S')
    pdf.line(x + 1.3, y + 1.8, x + 3.9, y + 1.8)
    pdf.line(x + 1.3, y + 3.0, x + 3.9, y + 3.0)
    pdf.line(x + 1.3, y + 4.2, x + 3.4, y + 4.2)
    return
  }
  if (icon === 'store') {
    pdf.roundedRect(x + 0.25, y + 1.8, 5.2, 3.8, 0.45, 0.45, 'S')
    pdf.line(x + 0.2, y + 1.8, x + 1.0, y + 0.3)
    pdf.line(x + 1.0, y + 0.3, x + 4.8, y + 0.3)
    pdf.line(x + 4.8, y + 0.3, x + 5.5, y + 1.8)
    pdf.line(x + 1.0, y + 1.8, x + 1.0, y + 0.4)
    pdf.line(x + 2.15, y + 1.8, x + 2.15, y + 0.4)
    pdf.line(x + 3.3, y + 1.8, x + 3.3, y + 0.4)
    pdf.line(x + 4.45, y + 1.8, x + 4.45, y + 0.4)
    pdf.rect(x + 2.25, y + 3.0, 1.3, 2.6, 'S')
    return
  }
  if (icon === 'bars') {
    pdf.rect(x, y + 3.5, 1.05, 2.0, 'F')
    pdf.rect(x + 1.95, y + 1.9, 1.05, 3.6, 'F')
    pdf.rect(x + 3.9, y, 1.05, 5.5, 'F')
    return
  }
  if (icon === 'pie') {
    pdf.circle(x + 2.75, y + 2.75, 2.4, 'S')
    pdf.line(x + 2.75, y + 2.75, x + 2.75, y + 0.35)
    pdf.line(x + 2.75, y + 2.75, x + 5.15, y + 2.75)
    pdf.triangle(x + 2.75, y + 2.75, x + 2.75, y + 0.35, x + 5.15, y + 2.75, 'F')
    return
  }
  if (icon === 'trophy') {
    pdf.roundedRect(x + 1.35, y + 0.2, 2.8, 2.5, 0.65, 0.65, 'S')
    pdf.line(x + 1.35, y + 0.8, x + 0.35, y + 0.8)
    pdf.line(x + 0.35, y + 0.8, x + 0.75, y + 2.2)
    pdf.line(x + 4.15, y + 0.8, x + 5.15, y + 0.8)
    pdf.line(x + 5.15, y + 0.8, x + 4.75, y + 2.2)
    pdf.line(x + 2.75, y + 2.7, x + 2.75, y + 4.35)
    pdf.line(x + 1.5, y + 4.35, x + 4.0, y + 4.35)
    pdf.line(x + 1.15, y + 5.05, x + 4.35, y + 5.05)
    return
  }
  if (icon === 'clock') {
    pdf.circle(x + 2.7, y + 2.7, 2.4, 'S')
    pdf.line(x + 2.7, y + 2.7, x + 2.7, y + 1.2)
    pdf.line(x + 2.7, y + 2.7, x + 4.0, y + 3.4)
    return
  }
  if (icon === 'alert') {
    pdf.triangle(x + 2.8, y, x, y + 5.2, x + 5.6, y + 5.2, 'S')
    pdf.line(x + 2.8, y + 1.5, x + 2.8, y + 3.3)
    pdf.circle(x + 2.8, y + 4.1, 0.25, 'F')
    return
  }
  if (icon === 'bulb') {
    pdf.circle(x + 2.7, y + 2.0, 1.95, 'S')
    pdf.line(x + 1.45, y + 3.45, x + 2.0, y + 4.15)
    pdf.line(x + 3.95, y + 3.45, x + 3.4, y + 4.15)
    pdf.line(x + 1.95, y + 4.25, x + 3.45, y + 4.25)
    pdf.line(x + 2.15, y + 5.0, x + 3.25, y + 5.0)
    return
  }
  pdf.roundedRect(x, y + 1.2, 5.5, 4.2, 0.8, 0.8, 'S')
  pdf.line(x + 0.8, y + 1.2, x + 1.5, y)
  pdf.line(x + 4.0, y, x + 4.7, y + 1.2)
  pdf.line(x + 1.3, y + 3.2, x + 4.2, y + 3.2)
}

const drawKpiIcon = (pdf, type, x, y, accent) => {
  const soft = soften(accent, 0.78)
  setFill(pdf, soft)
  pdf.roundedRect(x, y, 9.2, 9.2, 2.6, 2.6, 'F')
  setStroke(pdf, accent)
  setFill(pdf, accent)
  pdf.setLineWidth(0.72)
  if (type === 'sales') {
    pdf.line(x + 2.1, y + 4.9, x + 3.8, y + 6.4)
    pdf.line(x + 3.8, y + 6.4, x + 7.2, y + 2.7)
  } else if (type === 'orders') {
    pdf.roundedRect(x + 2.4, y + 2.0, 4.3, 5.1, 0.45, 0.45, 'S')
    pdf.line(x + 3.2, y + 3.6, x + 5.9, y + 3.6)
    pdf.line(x + 3.2, y + 5.1, x + 5.9, y + 5.1)
  } else if (type === 'ticket') {
    pdf.ellipse(x + 4.6, y + 2.8, 2.25, 0.9, 'S')
    pdf.ellipse(x + 4.6, y + 4.8, 2.25, 0.9, 'S')
    pdf.ellipse(x + 4.6, y + 6.5, 2.25, 0.9, 'S')
  } else if (type === 'received') {
    pdf.roundedRect(x + 1.8, y + 2.35, 5.5, 4.25, 0.6, 0.6, 'S')
    pdf.line(x + 2.2, y + 3.7, x + 6.9, y + 3.7)
  } else if (type === 'receivable') {
    pdf.circle(x + 4.6, y + 4.6, 2.55, 'S')
    pdf.line(x + 4.6, y + 4.6, x + 4.6, y + 2.7)
    pdf.line(x + 4.6, y + 4.6, x + 6.1, y + 5.3)
  } else {
    pdf.line(x + 2.8, y + 2.8, x + 6.4, y + 6.4)
    pdf.line(x + 6.4, y + 2.8, x + 2.8, y + 6.4)
  }
}

const toneColor = (tone) => tone === 'success' ? COLORS.teal : tone === 'danger' ? COLORS.danger : COLORS.muted

const drawKpiCard = (pdf, { x, y, w, title, value, comparison, icon, accent }) => {
  elevatedPanel(pdf, x, y, w, 36.5, { radius: 3.2 })
  drawKpiIcon(pdf, icon, x + 4.0, y + 4.0, accent)
  text(pdf, title, x + 16.2, y + 10.4, 7.75, COLORS.muted)
  text(pdf, value, x + 6.2, y + 23.5, value.length > 14 ? 13.2 : 16.1, COLORS.navy, { bold: true })
  if (comparison.tone === 'neutral') {
    text(pdf, 'Sem base comparável', x + 6.2, y + 32.2, 6.0, COLORS.muted, { bold: true })
    text(pdf, 'vs. período anterior', x + 33.0, y + 32.2, 5.25, COLORS.muted)
    return
  }
  const tone = toneColor(comparison.tone)
  setStroke(pdf, tone)
  pdf.setLineWidth(0.6)
  if (comparison.text.startsWith('-')) {
    pdf.line(x + 6.4, y + 29.1, x + 8.0, y + 30.9)
    pdf.line(x + 8.0, y + 30.9, x + 9.8, y + 29.1)
  } else {
    pdf.line(x + 6.4, y + 30.9, x + 8.0, y + 29.1)
    pdf.line(x + 8.0, y + 29.1, x + 9.8, y + 30.9)
  }
  text(pdf, comparison.text, x + 11.2, y + 32.2, 6.75, tone, { bold: true })
  text(pdf, 'vs. período anterior', x + 31.8, y + 32.2, 5.35, COLORS.muted)
}

const drawInsightPanel = (pdf, vm) => {
  roundedPanel(pdf, 10, 194.5, 190, 49.0, { fill: COLORS.mint, stroke: COLORS.mint, radius: 4 })
  drawMiniIcon(pdf, 'bars', 15, 200.8, COLORS.teal)
  text(pdf, 'Principais insights', 27, 204.4, 10.1, COLORS.navy, { bold: true })
  const ys = [213.3, 222.5, 231.7]
  vm.insights.slice(0, 3).forEach((item, index) => {
    setFill(pdf, COLORS.teal)
    pdf.circle(18.2, ys[index] - 1.7, 3.4, 'F')
    text(pdf, String(index + 1), 18.2, ys[index] + 0.2, 5.8, COLORS.white, { bold: true, align: 'center' })
    const prefixEnd = item.indexOf(':')
    if (prefixEnd > 0) {
      const prefix = `${item.slice(0, prefixEnd + 1)} `
      const rest = item.slice(prefixEnd + 1).trim()
      text(pdf, prefix, 25, ys[index], 6.4, COLORS.navy, { bold: true })
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.4)
      const prefixWidth = pdf.getTextWidth(prefix)
      const available = 137 - prefixWidth
      const restLines = pdf.splitTextToSize(rest, Math.max(42, available))
      text(pdf, restLines[0] || '', 25 + prefixWidth, ys[index], 6.05, COLORS.navy)
      if (restLines[1]) text(pdf, restLines[1], 25, ys[index] + 4.15, 5.9, COLORS.navy)
    } else {
      const lines = pdf.splitTextToSize(item, 138)
      text(pdf, lines[0], 25, ys[index], 6.25, COLORS.navy)
      if (lines[1]) text(pdf, lines[1], 25, ys[index] + 4.15, 5.9, COLORS.navy)
    }
  })
  const heights = [9, 15, 24]
  heights.forEach((height, index) => {
    setFill(pdf, [188, 236, 229])
    pdf.roundedRect(171 + index * 8, 237 - height, 5.5, height, 2.3, 2.3, 'F')
  })
}

const drawFinanceSplit = (pdf, vm) => {
  elevatedPanel(pdf, 10, 249.0, 93, 35.5, { radius: 3.2 })
  text(pdf, 'Recebido x a receber', 14, 257.4, 8.7, COLORS.navy, { bold: true })
  const x = 14; const y = 262.2; const w = 83; const h = 8.5
  setFill(pdf, COLORS.teal)
  pdf.roundedRect(x, y, w, h, 2.4, 2.4, 'F')
  const receivedWidth = w * clamp(vm.receivedShare / 100, 0, 1)
  const receivableWidth = Math.max(0, w - receivedWidth)
  if (receivableWidth > 0) {
    setFill(pdf, COLORS.tealSoft)
    pdf.rect(x + receivedWidth, y, receivableWidth, h, 'F')
  }
  if (vm.receivedShare > 12) text(pdf, `${number(vm.receivedShare)}%`, x + receivedWidth / 2, y + 5.8, 6.5, COLORS.white, { bold: true, align: 'center' })
  if (vm.receivableShare > 12) text(pdf, `${number(vm.receivableShare)}%`, x + receivedWidth + receivableWidth / 2, y + 5.8, 6.5, COLORS.navy, { bold: true, align: 'center' })
  setFill(pdf, COLORS.teal); pdf.circle(15.6, 276.0, 1.4, 'F')
  text(pdf, 'Recebido no período', 21, 276.7, 5.65, COLORS.muted)
  text(pdf, money(vm.metrics.receivedCents), 21, 282.4, 7.55, COLORS.navy, { bold: true })
  setFill(pdf, COLORS.tealSoft); pdf.circle(66.0, 276.0, 1.4, 'F')
  text(pdf, 'A receber do período', 71.5, 276.7, 5.65, COLORS.muted)
  text(pdf, money(vm.metrics.receivableCents), 71.5, 282.4, 7.55, COLORS.navy, { bold: true })
}

const drawComparisonPanel = (pdf, vm) => {
  elevatedPanel(pdf, 107, 249.0, 93, 35.5, { radius: 3.2 })
  text(pdf, 'Atual x período anterior', 111, 257.4, 8.7, COLORS.navy, { bold: true })
  const maxMagnitude = Math.max(1, ...vm.comparisonCards.map((item) => item.magnitude || 0))
  vm.comparisonCards.forEach((item, index) => {
    const y = 262.0 + index * 5.15
    text(pdf, item.label, 112, y + 2.0, 5.45, COLORS.muted)
    const compact = item.tone === 'neutral' ? 'Sem base' : item.text
    text(pdf, compact, 150.5, y + 2.0, 5.7, toneColor(item.tone), { bold: true, align: 'right' })
    setFill(pdf, COLORS.borderSoft)
    pdf.roundedRect(159, y, 31, 3.25, 1.55, 1.55, 'F')
    if (item.tone !== 'neutral' && item.magnitude > 0) {
      setFill(pdf, toneColor(item.tone))
      pdf.roundedRect(159, y, 31 * clamp(item.magnitude / maxMagnitude, 0.12, 1), 3.25, 1.55, 1.55, 'F')
    }
  })
}

const drawPageOne = (pdf, vm) => {
  drawBrandHeader(pdf)
  text(pdf, 'CENTRO DE RELATÓRIOS', 10, 38.7, 8.8, COLORS.teal, { bold: true })
  text(pdf, 'Resumo executivo', 10, 52.3, 24.0, COLORS.navy, { bold: true })
  text(pdf, 'Uma visão clara do seu restaurante para', 10, 62.9, 9.85, COLORS.muted)
  text(pdf, 'decisões mais inteligentes.', 10, 69.8, 9.85, COLORS.muted)

  pdf.addImage(EXECUTIVE_COVER_FOOD, 'JPEG', 139.0, 31.7, 71.0, 68.8)

  drawInfoItem(pdf, 10, 82.2, 'Operação', vm.operationName, 'store')
  drawInfoItem(pdf, 92, 82.2, 'Período', vm.periodLabel, 'calendar')

  roundedPanel(pdf, 10, 99.0, 190, 12.3, { fill: [243, 248, 251], stroke: [243, 248, 251], radius: 2 })
  drawMiniIcon(pdf, 'document', 16, 102.2, COLORS.teal)
  const generatedText = `Relatório gerado em ${vm.generatedLabel}${vm.filtersLabel ? ` · ${vm.filtersLabel}` : ''}`
  const generatedLine = generatedText.length > 105 ? `${generatedText.slice(0, 102)}...` : generatedText
  text(pdf, generatedLine, 25, 106.8, 6.2, COLORS.muted)
  text(pdf, 'Gerado pelo Gestão Delivery', 194, 106.8, 6.2, COLORS.muted, { align: 'right' })

  const gap = 4
  const cardW = (190 - gap * 2) / 3
  const salesComparison = comparisonValue(vm.comparisons.salesCents)
  const ordersComparison = comparisonValue(vm.comparisons.ordersCount)
  const ticketComparison = comparisonValue(vm.comparisons.averageTicketCents)
  const receivedComparison = comparisonValue(vm.comparisons.receivedCents)
  const receivableComparison = comparisonValue(vm.comparisons.receivableCents)
  const cancellationComparison = comparisonValue(vm.comparisons.cancellationRate, 'points')
  const cards = [
    ['Vendas registradas', money(vm.metrics.salesCents), salesComparison, 'sales', COLORS.teal],
    ['Pedidos', number(vm.metrics.ordersCount), ordersComparison, 'orders', COLORS.blue],
    ['Ticket médio', vm.metrics.averageTicketCents == null ? 'Indisponível' : money(vm.metrics.averageTicketCents), ticketComparison, 'ticket', COLORS.yellow],
    ['Recebido no período', money(vm.metrics.receivedCents), receivedComparison, 'received', COLORS.teal],
    ['A receber do período', money(vm.metrics.receivableCents), receivableComparison, 'receivable', COLORS.blue],
    ['Taxa de cancelamento', formatPercent(vm.metrics.cancellationRate), cancellationComparison, 'cancel', COLORS.danger],
  ]
  cards.forEach((card, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    drawKpiCard(pdf, { x: 10 + col * (cardW + gap), y: 114.0 + row * 40.5, w: cardW, title: card[0], value: card[1], comparison: card[2], icon: card[3], accent: card[4] })
  })

  drawInsightPanel(pdf, vm)
  drawFinanceSplit(pdf, vm)
  drawComparisonPanel(pdf, vm)
  drawFooter(pdf, vm, 1)
}

const CATEGORY_COLORS = [COLORS.teal, COLORS.tealSoft, COLORS.cyanDark, COLORS.yellow, COLORS.blue, COLORS.cyanPale]
const MODALITY_COLORS = [COLORS.teal, COLORS.tealSoft, COLORS.blue, COLORS.blueSoft]

const drawDonut = (pdf, cx, cy, radius, thickness, items) => {
  const usable = items.filter((item) => item.sharePercent > 0)
  if (!usable.length) {
    setStroke(pdf, COLORS.borderSoft)
    pdf.setLineWidth(thickness)
    pdf.circle(cx, cy, radius, 'S')
    return
  }
  let start = -90
  pdf.setLineCap('butt')
  pdf.setLineJoin('round')
  usable.forEach((item, index) => {
    const fullSpan = item.sharePercent * 3.6
    const gap = Math.min(1.5, fullSpan * 0.15)
    const span = Math.max(0.2, fullSpan - gap)
    const angleStart = start + gap / 2
    const segments = Math.max(6, Math.ceil(span / 1.3))
    const points = []
    for (let step = 0; step <= segments; step += 1) {
      const angle = (angleStart + span * step / segments) * Math.PI / 180
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
    }
    const vectors = []
    for (let i = 1; i < points.length; i += 1) vectors.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]])
    setStroke(pdf, CATEGORY_COLORS[index % CATEGORY_COLORS.length])
    pdf.setLineWidth(thickness)
    pdf.lines(vectors, points[0][0], points[0][1], [1, 1], 'S', false)
    start += fullSpan
  })
  pdf.setLineCap('butt')
}

const drawMixPanel = (pdf, vm) => {
  elevatedPanel(pdf, 10, 81.5, 105, 78.0, { radius: 3.2 })
  drawMiniIcon(pdf, 'bars', 15, 88.6, COLORS.teal)
  text(pdf, 'Composição das vendas', 25, 93.1, 10.4, COLORS.navy, { bold: true })
  text(pdf, 'Participação por categoria de produtos', 25, 99.6, 6.25, COLORS.muted)
  drawDonut(pdf, 40.5, 128.7, 16.2, 6.1, vm.categories)
  text(pdf, money(vm.merchandiseRevenueCents), 40.5, 128.0, 7.15, COLORS.navy, { bold: true, align: 'center' })
  text(pdf, 'em mercadorias', 40.5, 134.1, 5.15, COLORS.muted, { align: 'center' })
  const list = vm.categories.length ? vm.categories : [{ label: 'Sem dados', sharePercent: 0 }]
  list.slice(0, 6).forEach((item, index) => {
    const y = 112.5 + index * 7.3
    setFill(pdf, CATEGORY_COLORS[index % CATEGORY_COLORS.length])
    pdf.circle(66.0, y - 1.45, 1.45, 'F')
    const label = item.label.length > 22 ? `${item.label.slice(0, 20)}...` : item.label
    text(pdf, label, 72, y, 6.3, COLORS.navy)
    text(pdf, `${number(item.sharePercent)}%`, 110, y, 6.3, COLORS.navy, { bold: true, align: 'right' })
  })
}

const drawModalitiesPanel = (pdf, vm) => {
  elevatedPanel(pdf, 119, 81.5, 81, 78.0, { radius: 3.2 })
  drawMiniIcon(pdf, 'pie', 124, 88.6, COLORS.teal)
  text(pdf, 'Modalidades', 135, 93.1, 10.4, COLORS.navy, { bold: true })
  text(pdf, 'Participação nas vendas por canal', 135, 99.6, 6.25, COLORS.muted)
  const list = vm.modalities.length ? vm.modalities : [{ label: 'Sem dados', sharePercent: 0 }]
  list.slice(0, 4).forEach((item, index) => {
    const y = 111.5 + index * 12.7
    text(pdf, item.label, 124, y + 4.9, 6.45, COLORS.muted)
    setFill(pdf, COLORS.borderSoft)
    pdf.roundedRect(147.5, y, 36.5, 6.0, 1.35, 1.35, 'F')
    if (item.sharePercent > 0) {
      setFill(pdf, MODALITY_COLORS[index % MODALITY_COLORS.length])
      pdf.roundedRect(147.5, y, 36.5 * clamp(item.sharePercent / 100, 0.03, 1), 6.0, 1.35, 1.35, 'F')
    }
    text(pdf, `${number(item.sharePercent)}%`, 196, y + 4.9, 6.45, COLORS.navy, { bold: true, align: 'right' })
  })
}

const drawTopProducts = (pdf, vm) => {
  elevatedPanel(pdf, 10, 164.0, 190, 78.0, { radius: 3.2 })
  drawMiniIcon(pdf, 'trophy', 15, 171.0, COLORS.yellow)
  text(pdf, 'Top 5 produtos', 27, 174.9, 10.1, COLORS.navy, { bold: true })
  text(pdf, 'Produtos mais vendidos no período', 27, 180.9, 6.25, COLORS.muted)
  setFill(pdf, [239, 245, 248])
  pdf.rect(15, 184.0, 180, 8.4, 'F')
  text(pdf, '#', 18, 189.5, 6.15, COLORS.navy, { bold: true })
  text(pdf, 'Produto', 33, 189.5, 6.15, COLORS.navy, { bold: true })
  text(pdf, 'Unidades', 116, 189.5, 6.15, COLORS.navy, { bold: true, align: 'right' })
  text(pdf, 'Receita', 164, 189.5, 6.15, COLORS.navy, { bold: true, align: 'right' })
  text(pdf, 'Participação', 192, 189.5, 6.15, COLORS.navy, { bold: true, align: 'right' })
  const rows = vm.topProducts.length ? vm.topProducts : [{ rank: '-', name: 'Sem produtos no recorte', quantity: 0, revenueCents: 0, sharePercent: 0 }]
  rows.slice(0, 5).forEach((item, index) => {
    const rowTop = 192.4 + index * 9.0
    if (index % 2 === 1) {
      setFill(pdf, [249, 251, 252])
      pdf.rect(15, rowTop, 180, 9.0, 'F')
    }
    const y = rowTop + 5.9
    text(pdf, item.rank, 19, y, 6.35, COLORS.navy)
    const name = item.name.length > 34 ? `${item.name.slice(0, 32)}...` : item.name
    text(pdf, name, 33, y, 6.35, COLORS.navy)
    text(pdf, number(item.quantity), 116, y, 6.35, COLORS.navy, { align: 'right' })
    text(pdf, money(item.revenueCents), 164, y, 6.35, COLORS.navy, { align: 'right' })
    text(pdf, `${number(item.sharePercent)}%`, 192, y, 6.35, COLORS.navy, { align: 'right' })
  })
}

const drawObservationPanel = (pdf, vm) => {
  roundedPanel(pdf, 10, 245.0, 190, 41.0, { fill: COLORS.mint, stroke: COLORS.mint, radius: 3.2 })
  drawMiniIcon(pdf, 'bulb', 15, 251.1, COLORS.teal)
  text(pdf, 'Observações e oportunidades', 25, 255.6, 9.8, COLORS.navy, { bold: true })
  const starts = [14, 78, 142]
  vm.observations.slice(0, 3).forEach((item, index) => {
    if (index > 0) {
      setStroke(pdf, [205, 230, 227])
      pdf.setLineWidth(0.3)
      pdf.line(starts[index] - 5, 262.0, starts[index] - 5, 282.5)
    }
    const icon = item.kind === 'danger' ? 'alert' : item.kind === 'blue' ? 'clock' : 'bars'
    const iconColor = item.kind === 'danger' ? COLORS.danger : item.kind === 'blue' ? COLORS.blue : COLORS.teal
    drawMiniIcon(pdf, icon, starts[index], 262.3, iconColor)
    text(pdf, item.title, starts[index] + 11, 267.6, 7.05, COLORS.navy, { bold: true })
    const lines = pdf.splitTextToSize(item.text, 50)
    lines.slice(0, 3).forEach((line, lineIndex) => text(pdf, line, starts[index], 274.9 + lineIndex * 5.0, 5.95, COLORS.muted))
  })
}

const drawPageTwo = (pdf, vm) => {
  drawBrandHeader(pdf, { growthCallout: true })
  text(pdf, 'CENTRO DE RELATÓRIOS', 10, 38.7, 8.8, COLORS.teal, { bold: true })
  text(pdf, 'Análise detalhada', 10, 52.3, 24.0, COLORS.navy, { bold: true })
  drawInfoItem(pdf, 10, 62.7, 'Operação', vm.operationName, 'store')
  drawInfoItem(pdf, 72, 62.7, 'Período', vm.periodLabel, 'calendar')
  text(pdf, `Gerado em ${vm.generatedLabel}`, 197, 69.8, 6.0, COLORS.muted, { align: 'right' })
  text(pdf, 'pelo Gestão Delivery', 197, 75.8, 6.0, COLORS.muted, { align: 'right' })
  drawMixPanel(pdf, vm)
  drawModalitiesPanel(pdf, vm)
  drawTopProducts(pdf, vm)
  drawObservationPanel(pdf, vm)
  drawFooter(pdf, vm, 2)
}

export async function createPdfSummary(model = {}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const vm = buildExecutivePdfViewModel(model)
  drawPageOne(pdf, vm)
  pdf.addPage('a4', 'portrait')
  drawPageTwo(pdf, vm)
  return pdf
}