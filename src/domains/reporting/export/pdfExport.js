export async function createPdfSummary({ title = 'Centro de Relatórios', generatedAt, metrics = {} } = {}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  pdf.text(title, 14, 18)
  pdf.text(`Gerado em: ${generatedAt || ''}`, 14, 28)
  Object.entries(metrics).forEach(([label, value], index) => pdf.text(`${label}: ${value}`, 14, 40 + index * 8))
  return pdf
}
