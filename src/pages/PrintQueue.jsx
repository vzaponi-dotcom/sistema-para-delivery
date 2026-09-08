import PageHeader from '../components/PageHeader'

function PrintQueue() {
  return (
    <div className="print-queue-page">
      <PageHeader
        eyebrow="Operação"
        title="Fila de impressão"
        description="Acompanhe e gerencie as impressões da cozinha"
      />
      <section aria-label="Conteúdo da fila de impressão">
        <p>Os trabalhos de impressão aparecerão aqui.</p>
      </section>
    </div>
  )
}

export default PrintQueue
