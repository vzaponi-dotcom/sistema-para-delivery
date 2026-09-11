import Modal from './Modal'
import PrintingSettingsContent from './PrintingSettingsContent'

function PrintingSettings({ printing, settings, granted, onClose }) {
  return (
    <Modal title="Impressão" onClose={onClose}>
      <PrintingSettingsContent printing={printing} settings={settings} granted={granted} />
    </Modal>
  )
}

export default PrintingSettings
