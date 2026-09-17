import { shouldConfirmDraftExit } from './draftExitGuard.js'
import { resolveSettingsPolicyNavigationDraft } from '../surfaces/settings/policies/navigation.js'

export const getSettingsDraftForDestination = resolveSettingsPolicyNavigationDraft
export const shouldConfirmSettingsExit = shouldConfirmDraftExit

export function hasSettingsUnloadRisk(resources) {
  return Object.values(resources || {}).some((resource) => (
    resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status)
  ))
}
