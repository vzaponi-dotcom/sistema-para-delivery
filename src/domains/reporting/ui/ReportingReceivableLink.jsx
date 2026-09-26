import Icon from '../../../shared/ui/Icon.jsx'

export function ReportingReceivableLink({ className = '', label = 'Gerenciar em A receber' }) {
  return <a
    className={`button secondary-button reporting-receivable-link ${className}`.trim()}
    href="/financeiro/a-receber"
  >
    <Icon name="wallet" size={17} />
    <span>{label}</span>
  </a>
}
