const plural = (count, singular, pluralLabel = `${singular}s`) => (
  `${count} ${count === 1 ? singular : pluralLabel}`
)

const pendingPrintHelper = (pendingCount) => (
  pendingCount > 0
    ? `${plural(pendingCount, 'trabalho', 'trabalhos')} aguardando impressão.`
    : null
)

const primaryName = (status) => String(status?.primaryStation?.name || '').trim() || null
const urgencyTone = (pendingCount) => pendingCount > 0 ? 'danger' : 'warning'

export const buildPrintOperationalView = (status = {}, {
  pendingCount = 0,
  localPrinterName = null,
} = {}) => {
  const code = status?.code || 'verifying'
  const primaryStationName = primaryName(status)
  const pending = Math.max(0, Number(pendingCount) || 0)
  const base = { code, primaryStationName }

  if (code === 'ready') {
    const printerName = String(localPrinterName || '').trim()
    return {
      ...base,
      tone: 'success',
      title: 'Impressão disponível',
      description: status?.isLocalPrimary && printerName
        ? `${printerName} · Impressora desta estação.`
        : primaryStationName
          ? `Gerenciada pela estação ${primaryStationName}.`
          : 'Estação principal pronta para imprimir.',
      helper: pendingPrintHelper(pending),
    }
  }

  if (code === 'no_primary') {
    return {
      ...base,
      tone: 'warning',
      title: 'Estação de impressão não configurada',
      description: 'Defina uma estação Windows como responsável pela impressão automática.',
      helper: pending > 0
        ? `${plural(pending, 'trabalho', 'trabalhos')} aguardando uma estação principal.`
        : null,
    }
  }

  if (code === 'primary_offline') {
    return {
      ...base,
      tone: urgencyTone(pending),
      title: 'Estação de impressão indisponível',
      description: primaryStationName
        ? `A estação ${primaryStationName} está offline.`
        : 'A estação principal está offline.',
      helper: pending > 0
        ? `${plural(pending, 'trabalho', 'trabalhos')} aguardando a estação voltar.`
        : null,
    }
  }

  if (code === 'qz_unavailable') {
    return {
      ...base,
      tone: urgencyTone(pending),
      title: 'QZ Tray desconectado na estação principal',
      description: primaryStationName
        ? `A estação ${primaryStationName} está online, mas o QZ Tray não está disponível.`
        : 'A estação principal está online, mas o QZ Tray não está disponível.',
      helper: pendingPrintHelper(pending),
    }
  }

  if (code === 'printer_unconfigured') {
    return {
      ...base,
      tone: 'warning',
      title: 'Impressora não configurada',
      description: 'Selecione a impressora desta estação para começar a imprimir.',
      helper: pendingPrintHelper(pending),
    }
  }

  if (code === 'printer_unavailable') {
    const description = status?.physicalState === 'printer_offline'
      ? 'A impressora está desligada ou desconectada.'
      : status?.physicalState === 'printer_attention'
        ? 'A impressora requer atenção antes de continuar.'
        : 'A estação principal não consegue usar a impressora no momento.'
    return {
      ...base,
      tone: urgencyTone(pending),
      title: 'Impressora indisponível',
      description,
      helper: pendingPrintHelper(pending),
    }
  }

  return {
    ...base,
    code: 'verifying',
    tone: 'neutral',
    title: 'Verificando impressão',
    description: primaryStationName
      ? `Verificando a estação ${primaryStationName}.`
      : 'Aguardando informações da estação principal.',
    helper: pending > 0
      ? `${plural(pending, 'trabalho', 'trabalhos')} ${pending === 1 ? 'permanece' : 'permanecem'} na fila enquanto o status é verificado.`
      : null,
  }
}
