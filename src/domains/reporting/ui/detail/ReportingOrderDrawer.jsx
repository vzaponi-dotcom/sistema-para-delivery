import { useEffect, useState } from 'react'
import Icon from '../../../../shared/ui/Icon.jsx'
import { reportingApi } from '../../infrastructure/reportingApi.js'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100)
const statusClass = (status = '') => status === 'Cancelado'
  ? 'is-danger'
  : status === 'Em preparo'
    ? 'is-info'
    : status === 'Finalizado'
      ? 'is-neutral'
      : 'is-success'
const typeIcon = (type) => type === 'Retirada' ? 'pickup' : type === 'Local' ? 'table' : 'delivery'
const deadlineClass = (onTime) => onTime == null ? 'is-neutral' : onTime ? 'is-success' : 'is-danger'

export function ReportingOrderDrawer({ id, onClose, api = reportingApi }) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    void api.loadOrder(id, { signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted) setState({ loading: false, data: response.data, error: null })
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ loading: false, data: null, error })
    })
    return () => controller.abort()
  }, [api, id])

  const order = state.data
  const paymentLabel = order?.paymentAllocations?.length
    ? [...new Set(order.paymentAllocations.map((item) => item.method_label || item.method_code || 'Não informado'))].join(' + ')
    : 'Não informado'

  return <aside className="reporting-order-drawer" role="dialog" aria-modal="true" aria-label={`Pedido ${id}`}>
    <div className="reporting-drawer-header">
      <div className="reporting-drawer-title">
        <span className="reporting-drawer-title-icon"><Icon name="orders" size={19} /></span>
        <div>
          <div className="reporting-drawer-title-line">
            <h2>Pedido #{order?.order_number ?? id}</h2>
            {order ? <span className={`reporting-detail-status ${statusClass(order.status)}`}>{order.status}</span> : null}
          </div>
          {order ? <p>{order.order_date} · {order.type}</p> : null}
        </div>
      </div>
      <button className="reporting-drawer-close" type="button" onClick={onClose} aria-label="Fechar detalhes">×</button>
    </div>

    <div className="reporting-drawer-tabs" aria-label="Seções do pedido">
      <span className="is-active">Detalhes</span>
      <span>Histórico</span>
      <span>Cliente</span>
    </div>

    {state.loading ? <div className="reporting-drawer-state">Carregando pedido…</div> : state.error ? <div className="reporting-drawer-state is-error" role="alert">Não foi possível carregar o pedido.</div> : order ? <div className="reporting-drawer-content">
      <section className="reporting-drawer-section">
        <h3>Informações do pedido</h3>
        <div className="reporting-drawer-info-stack">
          <div className="reporting-drawer-info-row">
            <span className="reporting-drawer-info-icon"><Icon name="client" size={18} /></span>
            <div><small>Cliente</small><strong>{order.client_name_snapshot || 'Sem cliente'}</strong><span>{order.client_phone_snapshot || 'Telefone não informado'}</span></div>
          </div>
          <div className="reporting-drawer-info-row">
            <span className="reporting-drawer-info-icon"><Icon name="local" size={18} /></span>
            <div><small>Endereço</small><strong>{order.client_address_snapshot || 'Sem endereço'}</strong></div>
          </div>
        </div>
        <div className="reporting-drawer-meta-grid">
          <div><span className="reporting-drawer-meta-icon"><Icon name={typeIcon(order.type)} size={17} /></span><small>Modalidade</small><strong>{order.type || '—'}</strong></div>
          <div><span className="reporting-drawer-meta-icon"><Icon name="clock" size={17} /></span><small>Duração</small><strong>{order.durationMinutes == null ? '—' : `${order.durationMinutes} min`}</strong></div>
          <div><span className={`reporting-drawer-meta-icon ${deadlineClass(order.onTime)}`}><Icon name={order.onTime === false ? 'alert' : 'check'} size={17} /></span><small>Prazo</small><strong>{order.onTime == null ? '—' : order.onTime ? 'No prazo' : 'Atrasado'}</strong></div>
        </div>
      </section>

      <section className="reporting-drawer-section">
        <h3>Resumo financeiro</h3>
        <div className="reporting-drawer-financial-lines">
          {Number(order.delivery_fee_cents || 0) > 0 ? <div><span>Taxa de entrega</span><strong>{money(order.delivery_fee_cents)}</strong></div> : null}
          <div className="is-total"><span>Total do pedido</span><strong>{money(order.total_cents)}</strong></div>
        </div>
        <div className="reporting-drawer-financial-cards">
          <div className="is-received"><small>Valor recebido</small><strong>{money(order.paidCents)}</strong></div>
          <div><small>Pendente</small><strong>{money(order.pendingCents)}</strong></div>
        </div>
        <div className="reporting-drawer-payment-method"><span>Forma de pagamento</span><strong><Icon name="pix" size={17} />{paymentLabel}</strong></div>
      </section>

      <section className="reporting-drawer-section reporting-drawer-items-section">
        <h3>Itens do pedido ({order.items?.length || 0})</h3>
        <div className="reporting-drawer-items">{order.items?.map((item) => <div className="reporting-drawer-item" key={item.id}>
          <span className="reporting-drawer-item-icon"><Icon name="meal" size={18} /></span>
          <div><strong>{item.quantity} × {item.name_snapshot}</strong>{item.size_snapshot ? <small>{item.size_snapshot}</small> : null}</div>
          <strong>{money(item.quantity * item.unit_price_cents)}</strong>
        </div>)}</div>
      </section>
    </div> : <div className="reporting-drawer-state">Pedido indisponível.</div>}

    {order?.pendingCents > 0 ? <div className="reporting-drawer-footer">
      <a className="button secondary-button reporting-drawer-receivable" href="/financeiro/a-receber"><Icon name="wallet" size={17} />Gerenciar em A receber</a>
    </div> : null}
  </aside>
}
