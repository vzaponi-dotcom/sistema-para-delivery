import Icon from '../shared/ui/Icon.jsx'
import { KitchenDisplayCard } from './KitchenDisplayCard.jsx'
import { buildKitchenDisplayPresentation } from './kitchenDisplayPresentation.js'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short' })
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const Counter = ({ label, value, tone }) => <div className={`kds-counter kds-counter--${tone}`}><span>{label}</span><strong>{value}</strong></div>

export function KitchenDisplayBoard({ orders = [], timing, now = new Date(), highlightedIds = new Set(), stale = false }) {
  const presentation = buildKitchenDisplayPresentation(orders, timing, now, highlightedIds)
  return <section className="kds-board" aria-label="Painel da cozinha" data-stale={stale}>
    <header className="kds-header">
      <div className="kds-brand"><span className="kds-brand__icon" data-icon="chef-hat"><Icon name="chef-hat" size={54} /></span><h1>Cozinha</h1><span className="kds-brand__separator" aria-hidden="true" /><p>Boas refeições. Mais histórias.</p></div>
      <div className="kds-summary"><Counter label="Em preparo" value={presentation.counts.preparing} tone="preparing" /><Counter label="Atrasados" value={presentation.counts.late} tone="late" /><Counter label="Agendados" value={presentation.counts.scheduled} tone="scheduled" /></div>
      <div className="kds-clock"><time dateTime={now.toISOString()}>{timeFormatter.format(now)}</time><span>{dateFormatter.format(now)}</span></div>
    </header>
    {stale && <div className="kds-stale" role="status">Dados temporariamente desatualizados</div>}
    {presentation.cards.length ? <div className="kds-grid">{presentation.cards.map((entry) => <KitchenDisplayCard key={entry.order.id} entry={entry} now={now} />)}</div> : <div className="kds-empty"><Icon name="chef-hat" size={66} /><p>Nenhum pedido aguardando preparo.</p></div>}
    {presentation.overflow > 0 && <div className="kds-overflow">+ {presentation.overflow} {presentation.overflow === 1 ? 'pedido' : 'pedidos'} fora da tela</div>}
  </section>
}
