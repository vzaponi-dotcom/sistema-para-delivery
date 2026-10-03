import { DEFAULT_OPERATIONS, DEFAULT_PAYMENT_METHODS, paymentLabel } from '../../shared/businessPolicies.js'
import { nativeCancellationReasons, nativeFinanceCategories } from '../../shared/settingsCatalogs.js'
import { DEFAULT_PRINTING_POLICY } from '../printSettingsRepository.js'
import { prepareBuiltinRoles } from '../access/roles.js'

const nameKey = label => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

export function prepareBusinessDefaults(db, { businessId, name, now = new Date() }) {
  const at = now.toISOString(), timing = DEFAULT_OPERATIONS.timing
  const statements = [db.prepare("INSERT INTO businesses(id,slug,name,created_at,updated_at,access_status) VALUES(?,?,?,?,?,'pending')").bind(businessId, `company-${businessId}`, name, at, at)]
  for (const modality of DEFAULT_OPERATIONS.enabledModalities) statements.push(db.prepare('INSERT INTO business_order_modalities(business_id,code,active) VALUES(?,?,1)').bind(businessId, modality))
  statements.push(db.prepare(`INSERT INTO business_operation_settings(business_id,scheduled_prep_lead_minutes,scheduled_late_grace_minutes,
    immediate_late_after_minutes,immediate_very_late_after_minutes,default_modality,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(businessId, timing.scheduledPrepLeadMinutes, timing.scheduledLateGraceMinutes, timing.immediateLateAfterMinutes, timing.immediateVeryLateAfterMinutes, DEFAULT_OPERATIONS.defaultModality, at, at))
  for (const method of DEFAULT_PAYMENT_METHODS.methods) {
    const label = paymentLabel(method.code)
    statements.push(db.prepare('INSERT INTO business_payment_methods(business_id,code,label,name_key,active,is_system,sort_order) VALUES(?,?,?,?,?,1,?)').bind(businessId, method.code, label, nameKey(label), Number(method.active), method.sortOrder))
  }
  statements.push(db.prepare('INSERT INTO business_payment_settings(business_id,default_method,created_at,updated_at) VALUES(?,?,?,?)').bind(businessId, DEFAULT_PAYMENT_METHODS.defaultMethod, at, at))
  for (const table of ['business_cancellation_settings', 'business_finance_category_settings', 'business_profiles', 'business_print_topology_settings']) statements.push(db.prepare(`INSERT INTO ${table}(business_id,created_at,updated_at) VALUES(?,?,?)`).bind(businessId, at, at))
  for (const item of nativeCancellationReasons().items) statements.push(db.prepare('INSERT INTO business_cancel_reasons(business_id,id,label,name_key,active,is_system,requires_note,sort_order) VALUES(?,?,?,?,?,1,?,?)').bind(businessId, item.id, item.label, nameKey(item.label), Number(item.active), Number(item.requiresNote), item.sortOrder))
  for (const item of nativeFinanceCategories().items) statements.push(db.prepare('INSERT INTO business_finance_categories(business_id,id,type,label,name_key,active,is_system,sort_order) VALUES(?,?,?,?,?,?,1,?)').bind(businessId, item.id, item.type, item.label, nameKey(item.label), Number(item.active), item.sortOrder))
  statements.push(db.prepare('INSERT INTO business_print_settings(business_id,default_copies,table_tab_default_copies,created_at,updated_at) VALUES(?,?,?,?,?)').bind(businessId, DEFAULT_PRINTING_POLICY.orderDefaultCopies, DEFAULT_PRINTING_POLICY.tableTabDefaultCopies, at, at), ...prepareBuiltinRoles(db, businessId, now))
  return statements
}
