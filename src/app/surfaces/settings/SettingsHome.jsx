import Icon from '../../../shared/ui/Icon'
import PageHeader from '../../../shared/ui/PageHeader'
import '../../../settings.css'

const groups = [
  { id: 'company', title: 'Empresa e equipe', cards: [
    { id: 'settings-business-profile', title: 'Dados da empresa', description: 'Nome, logo, contato e endereço.', capability: 'business.profile.view', icon: 'building' },
    { id: 'access-team', title: 'Equipe e acessos', description: 'Contas, convites e permissões.', capability: 'access.users.view', icon: 'clients' },
    { id: 'access-activity', title: 'Histórico de atividades', description: 'Ações da equipe e do sistema.', capability: 'access.audit.view', icon: 'history' },
  ] },
  { id: 'operations', title: 'Operação', cards: [
    { id: 'settings-operations', title: 'Regras da operação', description: 'Tempos e modalidades de pedido.', capability: 'operations.settings.view', icon: 'filter' },
    { id: 'settings-cancellations', title: 'Motivos de cancelamento', description: 'Motivos disponíveis nos pedidos.', capability: 'orders.settings.view', icon: 'cancel' },
    { id: 'settings-kitchen-tv', title: 'TV da Cozinha', description: 'Conexão da TV com os pedidos.', capability: 'orders.settings.view', icon: 'system' },
    { id: 'settings-printing', title: 'Impressão', description: 'Vias, estação e impressora.', capabilities: ['printing.settings.view', 'printing.settings', 'printing.station.configure'], icon: 'printer' },
  ] },
  { id: 'finance', title: 'Financeiro', cards: [
    { id: 'settings-payments', title: 'Formas de pagamento', description: 'Métodos aceitos, ordem e padrão.', capability: 'payments.settings.view', icon: 'wallet' },
    { id: 'settings-finance-categories', title: 'Categorias financeiras', description: 'Categorias dos lançamentos manuais.', capability: 'finance.categories.view', icon: 'tags' },
  ] },
  { id: 'device', title: 'Este dispositivo', cards: [
    { id: 'settings-device', title: 'Aparência e som', description: 'Tema e alertas de novos pedidos.', capability: 'preferences.local', icon: 'laptop' },
  ] },
]

const hasCardAccess = (card, granted) => card.capability
  ? granted?.has(card.capability)
  : card.capabilities.some((capability) => granted?.has(capability))

function SettingsHome({ granted, implemented, onNavigate, businessName, user }) {
  const availableGroups = groups.map((group) => ({ ...group, cards: group.cards.filter((card) => implemented instanceof Set && implemented.has(card.id) && hasCardAccess(card, granted)) })).filter((group) => group.cards.length > 0)
  const hasCompanySettings = availableGroups.some((group) => group.id !== 'device')
  const companyName = String(businessName || '').trim()
  const profileName = user?.roleName?.trim()
  return <div className="settings-page settings-home">
    <PageHeader title={hasCompanySettings ? 'Configurações da empresa' : 'Configurações'} description={companyName || profileName ? <span className="settings-home-context">
      {companyName && <><Icon name="building" size={16} /><strong>{companyName}</strong></>}{profileName && <>{companyName && <span aria-hidden="true">·</span>}<span>{profileName}</span></>}
    </span> : undefined} />
    {availableGroups.map((group) => <section key={group.id} className={`settings-home-group${group.id === 'device' ? ' settings-home-device' : ''}`} data-group={group.id} aria-labelledby={`settings-home-${group.id}-heading`}>
      <div className="settings-home-group-heading"><h2 id={`settings-home-${group.id}-heading`}>{group.title}</h2>{group.id === 'device' && <span>Somente neste aparelho</span>}</div>
      <div className="settings-home-grid">
        {group.cards.map((card) => <button key={card.id} type="button" className="settings-home-card" aria-label={card.title} onClick={() => onNavigate(card.id)}>
          <span className="settings-home-card-icon"><Icon name={card.icon} size={20} /></span>
          <span className="settings-home-card-copy"><strong>{card.title}</strong><small>{card.description}</small></span>
          <Icon name="arrow-right" className="settings-home-card-arrow" size={18} />
        </button>)}
      </div>
    </section>)}
  </div>
}

export default SettingsHome
