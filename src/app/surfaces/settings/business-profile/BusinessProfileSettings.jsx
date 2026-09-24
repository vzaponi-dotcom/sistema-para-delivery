import { useEffect, useRef, useState } from 'react'
import Button from '../../../../shared/ui/Button.jsx'
import SettingsEditorShell from '../components/SettingsEditorShell.jsx'
import { SettingsBackLink } from '../components/SettingsBackAndSwitchControls.jsx'
import { createBusinessLogoPreviewOwner, normalizeBusinessLogo } from './businessLogoImage.js'
import './business-profile-settings.css'

const EMPTY_ADDRESS = Object.freeze({
  line: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postalCode: '',
})

const EMPTY_LOGO = Object.freeze({ present: false, version: null })

const initialsFromName = (name) => {
  const parts = String(name || '').trim().split(/\s+/u).filter(Boolean)
  if (!parts.length) return 'OP'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)[0]).toLocaleUpperCase('pt-BR')
}

const logoUrl = (logo) => {
  if (!logo?.present || !logo.version || String(logo.version).startsWith('local:')) return null
  return `/api/business/logo?v=${encodeURIComponent(logo.version)}`
}

const fieldValue = (value) => typeof value === 'string' ? value : ''

function BusinessProfileSettings({
  resourceState,
  readOnly = false,
  writesBlocked = false,
  onEdit,
  onSave,
  onDiscard,
  onReconcile,
  onReload,
  onReviewConflict,
  onNavigateHome,
  normalizeLogo = normalizeBusinessLogo,
  previewOwnerFactory = createBusinessLogoPreviewOwner,
}) {
  const data = resourceState?.draft || resourceState?.confirmed?.data || null
  const status = resourceState?.status || 'ready'
  const locked = readOnly || !data || ['loading', 'saving', 'unconfirmed', 'conflict'].includes(status)
  const fileInputRef = useRef(null)
  const transientRef = useRef(null)
  const localLogoVersionRef = useRef(null)
  const selectionRef = useRef(0)
  const previewOwnerRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [imageError, setImageError] = useState('')
  const [nameError, setNameError] = useState('')

  if (!previewOwnerRef.current) previewOwnerRef.current = previewOwnerFactory()

  const clearLocalLogo = () => {
    selectionRef.current += 1
    transientRef.current = null
    localLogoVersionRef.current = null
    previewOwnerRef.current?.clear?.()
    setPreviewUrl(null)
    setImageError('')
  }

  useEffect(() => () => {
    selectionRef.current += 1
    transientRef.current = null
    localLogoVersionRef.current = null
    previewOwnerRef.current?.dispose?.()
  }, [])

  useEffect(() => {
    const selectedVersion = localLogoVersionRef.current
    if (!selectedVersion) return
    const draftVersion = data?.logo?.version || null
    if (draftVersion !== selectedVersion) clearLocalLogo()
  }, [data?.logo?.version])

  const edit = (next) => {
    if (!data || readOnly) return false
    onEdit?.(next)
    return true
  }

  const editField = (field, value) => {
    if (!data) return
    if (field === 'name') {
      if (String(value).trim()) setNameError('')
      edit({ ...data, name: value })
      return
    }
    if (field === 'phone') {
      edit({ ...data, phone: value })
      return
    }
    const address = { ...(data.address || EMPTY_ADDRESS), [field]: value }
    edit({ ...data, address })
  }

  const selectLogo = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file || locked) return false
    const selection = ++selectionRef.current
    setImageError('')
    try {
      const normalized = await normalizeLogo(file)
      if (selection !== selectionRef.current) return false
      const localVersion = `local:${normalized.sha256}`
      transientRef.current = normalized.blob
      localLogoVersionRef.current = localVersion
      const nextPreview = previewOwnerRef.current.replace(normalized.blob)
      setPreviewUrl(nextPreview)
      edit({
        ...data,
        logo: { present: true, version: localVersion },
        logoAction: 'replace',
      })
      return true
    } catch (error) {
      if (selection !== selectionRef.current) return false
      setImageError(error?.message || 'Não foi possível preparar esta imagem.')
      return false
    } finally {
      if (event?.target) event.target.value = ''
    }
  }

  const removeLogo = () => {
    if (locked || !data) return false
    clearLocalLogo()
    return edit({
      ...data,
      logo: { ...EMPTY_LOGO },
      logoAction: 'remove',
    })
  }

  const discard = () => {
    if (['saving', 'loading', 'unconfirmed'].includes(status)) return false
    clearLocalLogo()
    setNameError('')
    return onDiscard?.()
  }

  const save = async () => {
    if (!data || writesBlocked || ['loading', 'saving', 'unconfirmed', 'conflict'].includes(status)) return false
    if (!String(data.name || '').trim()) {
      setNameError('Informe o nome da operação.')
      return false
    }
    setNameError('')
    const transient = data.logo?.version === localLogoVersionRef.current && transientRef.current
      ? { logoBlob: transientRef.current }
      : undefined
    const saved = await onSave?.(transient)
    if (saved === true) clearLocalLogo()
    return saved
  }

  const address = data?.address || EMPTY_ADDRESS
  const logo = data?.logo || EMPTY_LOGO
  const effectiveLogoUrl = previewUrl || logoUrl(logo)
  const previewName = String(data?.name || '').trim() || 'Nome da operação'
  const previewDetails = [
    String(data?.phone || '').trim(),
    [address.line, address.number].filter(Boolean).join(', '),
    [address.city, address.state].filter(Boolean).join(' - '),
  ].filter(Boolean)

  return <SettingsEditorShell
    title="Identidade da operação"
    description="Gerencie os dados que identificam o seu estabelecimento dentro da Mesiva."
    scope={<SettingsBackLink onClick={onNavigateHome} />}
    state={resourceState}
    readOnly={readOnly}
    saveBlocked={writesBlocked}
    saveBlockedMessage={writesBlocked ? 'Sem conexão. O rascunho e a prévia continuam disponíveis; reconecte para salvar.' : ''}
    onSave={save}
    onDiscard={discard}
    onReconcile={onReconcile}
    onReload={onReload}
    onReviewConflict={onReviewConflict}
    discardLabel="Cancelar"
    className="business-profile-editor"
  >
    {data ? <div className="business-profile-grid">
      <section className="business-profile-card" aria-labelledby="business-profile-identity-title">
        <div className="business-profile-card-heading">
          <div>
            <p className="section-kicker">Identidade</p>
            <h2 id="business-profile-identity-title">Nome e logo</h2>
            <p>Use a identidade do estabelecimento; a marca Mesiva continua sendo a marca do produto.</p>
          </div>
        </div>

        <label className="business-profile-field">
          <span>Nome da operação</span>
          <input
            name="name"
            value={fieldValue(data.name)}
            maxLength={120}
            disabled={locked}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'business-profile-name-error' : undefined}
            onChange={(event) => editField('name', event.target.value)}
          />
          {nameError && <small id="business-profile-name-error" className="business-profile-field-error" role="alert">{nameError}</small>}
        </label>

        <div className="business-profile-logo-field">
          <div className="business-profile-logo-copy">
            <strong>Logo da operação</strong>
            <small>PNG, JPG ou WebP. A imagem é preparada localmente e só é enviada ao salvar.</small>
          </div>
          {!readOnly && <>
            <input
              ref={fileInputRef}
              className="business-profile-logo-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Selecionar logo"
              disabled={locked}
              onChange={selectLogo}
            />
            <div className="business-profile-logo-actions">
              <Button type="button" variant="secondary" disabled={locked} onClick={() => fileInputRef.current?.click()}>
                {logo.present ? 'Trocar imagem' : 'Selecionar imagem'}
              </Button>
              {logo.present && <Button type="button" variant="secondary" disabled={locked} onClick={removeLogo}>Remover logo</Button>}
            </div>
          </>}
          {imageError && <p className="business-profile-field-error" role="alert">{imageError}</p>}
        </div>
      </section>

      <section className="business-profile-card" aria-labelledby="business-profile-contact-title">
        <div className="business-profile-card-heading">
          <div>
            <p className="section-kicker">Contato</p>
            <h2 id="business-profile-contact-title">Telefone</h2>
            <p>Informação administrativa do estabelecimento.</p>
          </div>
        </div>
        <label className="business-profile-field">
          <span>Telefone</span>
          <input
            name="phone"
            value={fieldValue(data.phone)}
            maxLength={32}
            disabled={locked}
            placeholder="(19) 99999-9999"
            onChange={(event) => editField('phone', event.target.value)}
          />
        </label>
      </section>

      <section className="business-profile-card business-profile-address-card" aria-labelledby="business-profile-address-title">
        <div className="business-profile-card-heading">
          <div>
            <p className="section-kicker">Endereço</p>
            <h2 id="business-profile-address-title">Localização do estabelecimento</h2>
            <p>Preencha somente os campos que fazem sentido para a operação.</p>
          </div>
        </div>
        <div className="business-profile-address-grid">
          <label className="business-profile-field business-profile-field-wide">
            <span>Logradouro</span>
            <input name="address.line" value={fieldValue(address.line)} maxLength={120} disabled={locked} onChange={(event) => editField('line', event.target.value)} />
          </label>
          <label className="business-profile-field">
            <span>Número</span>
            <input name="address.number" value={fieldValue(address.number)} maxLength={30} disabled={locked} onChange={(event) => editField('number', event.target.value)} />
          </label>
          <label className="business-profile-field">
            <span>Complemento</span>
            <input name="address.complement" value={fieldValue(address.complement)} maxLength={80} disabled={locked} onChange={(event) => editField('complement', event.target.value)} />
          </label>
          <label className="business-profile-field">
            <span>Bairro</span>
            <input name="address.neighborhood" value={fieldValue(address.neighborhood)} maxLength={80} disabled={locked} onChange={(event) => editField('neighborhood', event.target.value)} />
          </label>
          <label className="business-profile-field">
            <span>Cidade</span>
            <input name="address.city" value={fieldValue(address.city)} maxLength={80} disabled={locked} onChange={(event) => editField('city', event.target.value)} />
          </label>
          <label className="business-profile-field business-profile-field-compact">
            <span>UF</span>
            <input name="address.state" value={fieldValue(address.state)} maxLength={2} disabled={locked} onChange={(event) => editField('state', event.target.value.toLocaleUpperCase('pt-BR'))} />
          </label>
          <label className="business-profile-field">
            <span>CEP</span>
            <input name="address.postalCode" value={fieldValue(address.postalCode)} maxLength={16} disabled={locked} inputMode="numeric" onChange={(event) => editField('postalCode', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="business-profile-card business-profile-preview-card" aria-labelledby="business-profile-preview-title">
        <div className="business-profile-card-heading">
          <div>
            <p className="section-kicker">Prévia</p>
            <h2 id="business-profile-preview-title">Como a operação será identificada</h2>
            <p>Esta prévia usa somente o rascunho atual e não publica alterações automaticamente.</p>
          </div>
        </div>
        <div className="business-profile-preview">
          <div className="business-profile-preview-logo">
            {effectiveLogoUrl
              ? <img src={effectiveLogoUrl} alt="Logo da operação" />
              : <span aria-label="Iniciais da operação">{initialsFromName(previewName)}</span>}
          </div>
          <div className="business-profile-preview-copy">
            <strong>{previewName}</strong>
            {previewDetails.length
              ? previewDetails.map((line) => <span key={line}>{line}</span>)
              : <span>Dados de contato opcionais</span>}
          </div>
        </div>
      </section>
    </div> : <p className="settings-empty-state">Os dados da operação ainda não estão disponíveis.</p>}
  </SettingsEditorShell>
}

export default BusinessProfileSettings
