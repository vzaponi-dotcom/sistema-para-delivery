import Button from '../components/Button'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

function Finance({ totals, movements, currency, onAddMovement }) {
  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Fluxo de caixa"
        description="Visualize entradas, saídas e saldo. Pagamentos de pedidos entram automaticamente quando forem confirmados em A Receber."
        actions={<Button icon="plus" onClick={onAddMovement}>Novo movimento</Button>}
      />

      <section className="stats-grid stats-grid-three" aria-label="Resumo financeiro">
        <StatCard label="Entradas" value={currency(totals.entries)} helper="Receita registrada" icon="arrow-up" tone="success" />
        <StatCard label="Saídas" value={currency(totals.exits)} helper="Despesas registradas" icon="arrow-down" tone="danger" />
        <StatCard label="Saldo" value={currency(totals.balance)} helper="Entradas menos saídas" icon="wallet" tone={totals.balance >= 0 ? 'neutral' : 'danger'} />
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Histórico</span>
            <h2>Movimentações</h2>
          </div>
          <span className="toolbar-count">{movements.length} registro(s)</span>
        </div>

        <div className="movement-list">
          {movements.map((movement) => (
            <article className="movement-row" key={movement.id}>
              <div className={movement.type === 'entrada' ? 'movement-icon incoming' : 'movement-icon outgoing'}>
                <Icon name={movement.type === 'entrada' ? 'arrow-up' : 'arrow-down'} size={18} />
              </div>
              <div className="movement-main">
                <div className="movement-title-line">
                  <strong>{movement.description}</strong>
                  <span className={movement.type === 'entrada' ? 'movement-tag incoming' : 'movement-tag outgoing'}>
                    {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                  {movement.source === 'order-payment' && <span className="movement-tag incoming">Pedido recebido</span>}
                </div>
                <span>
                  {movement.category} · {movement.date}
                  {movement.paymentMethod ? ` · ${movement.paymentMethod}` : ''}
                </span>
              </div>
              <strong className={movement.type === 'entrada' ? 'movement-value positive' : 'movement-value negative'}>
                {movement.type === 'entrada' ? '+' : '-'}{currency(movement.value)}
              </strong>
            </article>
          ))}
        </div>

        {!movements.length && (
          <div className="empty-state">
            <Icon name="finance" size={28} />
            <strong>Nenhuma movimentação registrada</strong>
            <span>Registre uma entrada ou saída para começar o controle.</span>
          </div>
        )}
      </section>
    </>
  )
}

export default Finance
