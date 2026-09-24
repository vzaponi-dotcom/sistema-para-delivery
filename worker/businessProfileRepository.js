import { EMPTY_BUSINESS_PROFILE, parseBusinessProfile } from '../shared/businessProfile.js'
import {
  clearSettingsAssertions,
  hashSettingsPayload,
  prepareSettingsAssertion,
  readSettingsReceipt,
  settingsError,
} from './settingsTransactions.js'

const RESOURCE = 'businessProfile'

const profileError = (code, status, message, extra = {}) => Object.assign(new Error(message), { code, status, ...extra })
const unavailable = (cause, extra = {}) => profileError(
  'BUSINESS_PROFILE_UNAVAILABLE',
  503,
  'Não foi possível carregar ou salvar os dados da operação.',
  { cause, ...extra },
)
const revisionConflict = () => profileError(
  'BUSINESS_PROFILE_REVISION_CONFLICT',
  409,
  'Os dados da operação foram alterados em outro dispositivo.',
)
const invalid = (field = 'profile') => profileError(
  'BUSINESS_PROFILE_INVALID',
  400,
  'Dados da operação inválidos.',
  { field },
)

const safeLogo = (logo) => logo
  ? { present: true, version: logo.updatedAt }
  : { present: false, version: null }

const resource = (revision, data, createdAt, updatedAt) => ({
  resource: RESOURCE,
  revision,
  data,
  meta: { createdAt, updatedAt },
})

const EMPTY_ADDRESS = EMPTY_BUSINESS_PROFILE.address

const publicData = (profile, logo) => ({
  name: profile.name,
  phone: profile.phone,
  address: profile.address,
  logo: safeLogo(logo),
})

const SELECT_PROFILE = `SELECT
  b.id AS business_id,
  b.name AS business_name,
  p.business_id AS profile_business_id,
  p.revision,
  p.phone,
  p.address_line,
  p.address_number,
  p.address_complement,
  p.neighborhood,
  p.city,
  p.state,
  p.postal_code,
  p.logo_object_key,
  p.logo_content_type,
  p.logo_sha256,
  p.logo_size_bytes,
  p.logo_updated_at,
  p.created_at,
  p.updated_at,
  (SELECT count(*) FROM (
    SELECT mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at
    FROM settings_mutation_receipts
    WHERE business_id = b.id AND resource_key = 'businessProfile'
  )) AS receipt_count,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger'
    AND name IN ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
FROM businesses b
LEFT JOIN business_profiles p ON p.business_id = b.id
WHERE b.id = ?`

function normalizeStoredLogo(row) {
  const values = [
    row.logo_object_key,
    row.logo_content_type,
    row.logo_sha256,
    row.logo_size_bytes,
    row.logo_updated_at,
  ]
  if (values.every((value) => value === null)) return null
  if (
    typeof row.logo_object_key !== 'string' || !row.logo_object_key.trim()
    || typeof row.logo_content_type !== 'string' || !row.logo_content_type.trim()
    || typeof row.logo_sha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(row.logo_sha256)
    || !Number.isSafeInteger(row.logo_size_bytes) || row.logo_size_bytes < 0
    || typeof row.logo_updated_at !== 'string' || !Number.isFinite(Date.parse(row.logo_updated_at))
  ) throw unavailable()
  return {
    objectKey: row.logo_object_key,
    contentType: row.logo_content_type,
    sha256: row.logo_sha256.toLocaleLowerCase('en-US'),
    sizeBytes: row.logo_size_bytes,
    updatedAt: row.logo_updated_at,
  }
}

function decode(row) {
  if (!row || row.guards !== 2) throw unavailable()

  if (row.profile_business_id === null) {
    if (row.receipt_count) throw unavailable()
    let data
    try {
      data = parseBusinessProfile({
        ...EMPTY_BUSINESS_PROFILE,
        name: row.business_name,
        address: { ...EMPTY_ADDRESS },
      })
    } catch (cause) {
      throw unavailable(cause)
    }
    return {
      resource: resource(0, publicData(data, null), null, null),
      internalLogo: null,
      profileExists: false,
    }
  }

  if (
    !Number.isSafeInteger(row.revision) || row.revision < 1
    || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))
  ) throw unavailable()

  let parsed
  let internalLogo
  try {
    parsed = parseBusinessProfile({
      name: row.business_name,
      phone: row.phone,
      address: {
        line: row.address_line,
        number: row.address_number,
        complement: row.address_complement,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
      },
    })
    internalLogo = normalizeStoredLogo(row)
  } catch (cause) {
    if (cause?.code === 'BUSINESS_PROFILE_UNAVAILABLE') throw cause
    throw unavailable(cause)
  }

  return {
    resource: resource(row.revision, publicData(parsed, internalLogo), row.created_at, row.updated_at),
    internalLogo,
    profileExists: true,
  }
}

async function loadSnapshot(db, businessId) {
  try {
    return decode(await db.prepare(SELECT_PROFILE).bind(businessId).first())
  } catch (cause) {
    if (cause?.code === 'BUSINESS_PROFILE_UNAVAILABLE') throw cause
    throw unavailable(cause)
  }
}

export async function loadBusinessProfile(db, businessId) {
  return (await loadSnapshot(db, businessId)).resource
}

function validateSaveInput(input) {
  if (
    !input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => !['expectedRevision', 'mutationId', 'data'].includes(key))
    || !Number.isSafeInteger(input.expectedRevision)
    || input.expectedRevision < 0
    || input.expectedRevision >= Number.MAX_SAFE_INTEGER
    || typeof input.mutationId !== 'string'
    || !input.mutationId.trim()
    || input.mutationId.length > 120
  ) throw invalid()
  return parseBusinessProfile(input.data)
}

function normalizeResolvedLogo(value) {
  if (value === undefined) return { mode: 'keep', logo: undefined }
  if (value === null) return { mode: 'remove', logo: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('logo')
  if (Object.keys(value).some((key) => !['objectKey', 'contentType', 'sha256', 'sizeBytes', 'updatedAt'].includes(key))) {
    throw invalid('logo')
  }
  if (
    typeof value.objectKey !== 'string' || !value.objectKey.trim()
    || typeof value.contentType !== 'string' || !value.contentType.trim()
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(value.sha256)
    || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 0
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
  ) throw invalid('logo')
  return {
    mode: 'replace',
    logo: {
      objectKey: value.objectKey,
      contentType: value.contentType,
      sha256: value.sha256.toLocaleLowerCase('en-US'),
      sizeBytes: value.sizeBytes,
      updatedAt: value.updatedAt,
    },
  }
}

function sameLogo(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function logoHashShape(resolved) {
  if (resolved.mode === 'keep') return { action: 'keep' }
  if (resolved.mode === 'remove') return { action: 'remove' }
  return {
    action: 'replace',
    sha256: resolved.logo.sha256,
    contentType: resolved.logo.contentType,
    sizeBytes: resolved.logo.sizeBytes,
  }
}

function savedFromReceipt(receipt, payloadHash, data, logo) {
  if (receipt.payloadHash !== payloadHash) throw settingsError('SETTINGS_MUTATION_REUSED', 409)
  if (!Number.isFinite(Date.parse(receipt.resourceCreatedAt)) || !Number.isFinite(Date.parse(receipt.resourceUpdatedAt))) {
    throw unavailable()
  }
  return {
    resource: resource(
      receipt.committedRevision,
      publicData(data, logo),
      receipt.resourceCreatedAt,
      receipt.resourceUpdatedAt,
    ),
    receipt: {
      mutationId: receipt.mutationId,
      committedRevision: receipt.committedRevision,
      committedAt: receipt.committedAt,
      replayed: true,
    },
  }
}

function logoBindings(logo) {
  return logo
    ? [logo.objectKey, logo.contentType, logo.sha256, logo.sizeBytes, logo.updatedAt]
    : [null, null, null, null, null]
}

export async function saveBusinessProfile(db, businessId, input, resolvedLogoValue = undefined, now = new Date()) {
  let data
  let resolvedLogo
  try {
    data = validateSaveInput(input)
    resolvedLogo = normalizeResolvedLogo(resolvedLogoValue)
  } catch (error) {
    if (error?.code === 'BUSINESS_PROFILE_INVALID') throw error
    if (error?.code === 'BUSINESS_PROFILE_INVALID' || error?.code === 'SETTINGS_INVALID') throw invalid(error.field)
    throw error
  }

  const { expectedRevision, mutationId } = input
  const logicalPayload = {
    businessId,
    resource: RESOURCE,
    expectedRevision,
    data,
    logo: logoHashShape(resolvedLogo),
  }
  const payloadHash = await hashSettingsPayload(logicalPayload)

  let current
  try {
    current = await loadSnapshot(db, businessId)
  } catch (cause) {
    throw cause?.code === 'BUSINESS_PROFILE_UNAVAILABLE' ? cause : unavailable(cause)
  }

  let existingReceipt
  try {
    existingReceipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
  } catch (cause) {
    if (cause?.code === 'SETTINGS_REVISION_CONFLICT') throw revisionConflict()
    throw cause
  }

  const nextLogo = resolvedLogo.mode === 'keep'
    ? current.internalLogo
    : resolvedLogo.logo

  if (existingReceipt) return savedFromReceipt(existingReceipt, payloadHash, data, nextLogo)

  if (current.resource.revision !== expectedRevision) {
    let racedReceipt
    try {
      racedReceipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
    } catch (cause) {
      if (cause?.code === 'SETTINGS_REVISION_CONFLICT') throw revisionConflict()
      throw cause
    }
    if (racedReceipt) return savedFromReceipt(racedReceipt, payloadHash, data, nextLogo)
    throw revisionConflict()
  }

  const initialize = current.resource.revision === 0
  const currentPlain = {
    name: current.resource.data.name,
    phone: current.resource.data.phone,
    address: current.resource.data.address,
  }
  const changed = initialize
    || JSON.stringify(currentPlain) !== JSON.stringify(data)
    || !sameLogo(current.internalLogo, nextLogo)

  const committedRevision = current.resource.revision + Number(changed)
  const committedAt = now.toISOString()
  const createdAt = current.resource.meta.createdAt ?? committedAt
  const updatedAt = changed ? committedAt : current.resource.meta.updatedAt
  const txId = crypto.randomUUID()

  const statements = [
    prepareSettingsAssertion(
      db,
      txId,
      'revision',
      'coalesce((SELECT revision FROM business_profiles WHERE business_id = ?), 0) = ?',
      [businessId, expectedRevision],
    ),
  ]

  if (initialize) {
    statements.push(prepareSettingsAssertion(
      db,
      txId,
      'state',
      `EXISTS (SELECT 1 FROM businesses WHERE id = ?)
       AND NOT EXISTS (SELECT 1 FROM business_profiles WHERE business_id = ?)
       AND NOT EXISTS (
         SELECT 1 FROM settings_mutation_receipts
         WHERE business_id = ? AND resource_key = 'businessProfile'
       )`,
      [businessId, businessId, businessId],
    ))
    const logo = logoBindings(nextLogo)
    statements.push(db.prepare(`INSERT INTO business_profiles (
      business_id, revision, phone, address_line, address_number, address_complement,
      neighborhood, city, state, postal_code, logo_object_key, logo_content_type,
      logo_sha256, logo_size_bytes, logo_updated_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      businessId,
      committedRevision,
      data.phone,
      data.address.line,
      data.address.number,
      data.address.complement,
      data.address.neighborhood,
      data.address.city,
      data.address.state,
      data.address.postalCode,
      ...logo,
      createdAt,
      updatedAt,
    ))
  } else if (changed) {
    const logo = logoBindings(nextLogo)
    statements.push(db.prepare(`UPDATE business_profiles SET
      revision = ?,
      phone = ?,
      address_line = ?,
      address_number = ?,
      address_complement = ?,
      neighborhood = ?,
      city = ?,
      state = ?,
      postal_code = ?,
      logo_object_key = ?,
      logo_content_type = ?,
      logo_sha256 = ?,
      logo_size_bytes = ?,
      logo_updated_at = ?,
      updated_at = ?
      WHERE business_id = ?`).bind(
      committedRevision,
      data.phone,
      data.address.line,
      data.address.number,
      data.address.complement,
      data.address.neighborhood,
      data.address.city,
      data.address.state,
      data.address.postalCode,
      ...logo,
      updatedAt,
      businessId,
    ))
  }

  if (changed) {
    statements.push(db.prepare('UPDATE businesses SET name = ?, updated_at = ? WHERE id = ?')
      .bind(data.name, updatedAt, businessId))
  }

  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts (
    business_id, resource_key, mutation_id, payload_hash, committed_revision,
    committed_at, resource_created_at, resource_updated_at
  ) VALUES (?, 'businessProfile', ?, ?, ?, ?, ?, ?)`).bind(
    businessId,
    mutationId,
    payloadHash,
    committedRevision,
    committedAt,
    createdAt,
    updatedAt,
  ))

  statements.push(
    clearSettingsAssertions(db, txId),
    db.prepare(SELECT_PROFILE).bind(businessId),
  )

  try {
    const results = await db.batch(statements)
    const decoded = decode(results.at(-1).results[0])
    return {
      resource: decoded.resource,
      receipt: {
        mutationId,
        committedRevision,
        committedAt,
        replayed: false,
      },
    }
  } catch (cause) {
    let receipt
    try {
      receipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
    } catch (receiptError) {
      if (receiptError?.code === 'SETTINGS_REVISION_CONFLICT') throw revisionConflict()
      throw unavailable(receiptError)
    }
    if (receipt) return savedFromReceipt(receipt, payloadHash, data, nextLogo)
    if (String(cause?.message).includes('SETTINGS_REVISION_CONFLICT')) throw revisionConflict()
    throw unavailable(cause, { outcome: 'unconfirmed' })
  }
}
