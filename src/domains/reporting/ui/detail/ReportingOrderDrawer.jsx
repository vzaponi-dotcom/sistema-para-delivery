import { useEffect, useState } from 'react'
import { reportingApi } from '../../infrastructure/reportingApi.js'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

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
  return <aside className="reporting-order-drawer" role="dialog" aria-modal="true" aria-label={`Pedido ${id}`}>
    <div className="reporting-drawer-header"><h2>Pedido #{order?.order_number ?? id}</h2><button type="button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
    {state.loading ? <p>Carregando pedido…</p> : state.error ? <p role="alert">Não foi possível carregar o pedido.</p> : order ? <>
      <p>{order.order_date} · {order.status} · {order.type}</p>
      <h3>Informações do pedido</h3>
      <dl><dt>Cliente</dt><dd>{order.client_name_snapshot}</dd><dt>Telefone</dt><dd>{order.client_phone_snapshot || 'Não informado'}</dd><dt>Endereço</dt><dd>{order.client_address_snapshot || 'Não informado'}</dd><dt>Duração operacional</dt><dd>{order.durationMinutes == null ? 'Indisponível' : `${order.durationMinutes} min`}</dd><dt>Prazo</dt><dd>{order.onTime == null ? 'Indisponível' : order.onTime ? 'No prazo' : 'Atrasado'}</dd></dl>
      <h3>Resumo financeiro</h3><dl><dt>Total</dt><dd>{money(order.total_cents)}</dd><dt>Recebido</dt><dd>{money(order.paidCents)}</dd><dt>Pendente</dt><dd>{money(order.pendingCents)}</dd></dl>
      {order.paymentAllocations?.length ? <ul>{order.paymentAllocations.map((item, index) => <li key={`${item.method_code || item.method_label}-${index}`}>{item.method_label}: {money(item.amount_cents)}</li>)}</ul> : null}
      <h3>Itens do pedido</h3><ul>{order.items?.map((item) => <li key={item.id}>{item.quantity} × {item.name_snapshot}{item.size_snapshot ? ` · ${item.size_snapshot}` : ''} — {money(item.quantity * item.unit_price_cents)}</li>)}</ul>
      {order.pendingCents > 0 ? <a className="button secondary-button" href="/financeiro/a-receber">Gerenciar em A receber</a> : null}
    </> : <p>Pedido indisponível.</p>}
  </aside>
}
