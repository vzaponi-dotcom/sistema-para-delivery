import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import '../settings.css'

const cards = [
  { id: 'settings-operations', title: 'Operação', description: 'Tempos da cozinha e critérios de atraso.', capability: 'operations.settings.view', icon: 'settings' },
  { id: 'settings-payments', title: 'Formas de pagamento', description: 'Métodos aceitos, ordem e padrão.', capability: 'payments.settings.view', icon: 'wallet' },
  { id: 'settings-modalities', title: 'Modalidades de pedido', description: 'Entrega, retirada e consumo no local.', capability: 'operations.settings.view', icon: 'clipboard' },
  { id: 'settings-cancellations', title: 'Motivos de cancelamento', description: 'Motivos disponíveis ao cancelar pedidos.', capability: 'orders.settings.view', icon: 'cancel' },
  { id: 'settings-finance-categories', title: 'Categorias financeiras', description: 'Categorias dos lançamentos manuais.', capability: 'finance.categories.view', icon: 'finance' },
  { id: 'settings-printing', title: 'Impressão', description: 'Vias do negócio, estação e impressora local.', capabilities: ['printing.settings.view', 'printing.settings', 'printing.station.view'], icon: 'printer' },
  { id: 'settings-device', title: 'Preferências deste dispositivo', description: 'Tema e som de novos pedidos.', capability: 'preferences.local', icon: 'system' },
]

const hasCardAccess = (card, granted) => card.capability
  ? granted?.has(card.capability)
  : card.capabilities.some((capability) => granted?.has(capability))

function SettingsHome({ granted, implemented, onNavigate }) {
  const availableCards = cards.filter((card) => implemented instanceof Set && implemented.has(card.id) && hasCardAccess(card, granted))
  return <div className="settings-page settings-home">
    <PageHeader eyebrow="Configurações" title="Configurações" description="Políticas do negócio, catálogos e preferências deste dispositivo." />
    <section className="settings-home-grid" aria-label="Categorias de configurações">
      {availableCards.map((card) => <button key={card.id} type="button" className="settings-home-card" aria-label={card.title} onClick={() => onNavigate(card.id)}>
        <span className="settings-home-card-icon"><Icon name={card.icon} size={22} /></span>
        <span className="settings-home-card-copy"><strong>{card.title}</strong><small>{card.description}</small></span>
        <Icon name="arrow-down" className="settings-home-card-arrow" size={18} />
      </button>)}
    </section>
  </div>
}

export default SettingsHome
