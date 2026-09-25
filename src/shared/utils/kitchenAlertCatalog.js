export const KITCHEN_ALERT_PROFILES = Object.freeze([
  Object.freeze({
    id: 'bell',
    label: 'Campainha',
    description: 'Duas campainhas claras para chamar atenção sem soar agressivo.',
    tones: Object.freeze([
      Object.freeze({ frequency: 660, start: 0, duration: 0.46, type: 'triangle', gain: 0.24 }),
      Object.freeze({ frequency: 990, start: 0.02, duration: 0.38, type: 'sine', gain: 0.12 }),
      Object.freeze({ frequency: 660, start: 0.62, duration: 0.46, type: 'triangle', gain: 0.24 }),
      Object.freeze({ frequency: 990, start: 0.64, duration: 0.38, type: 'sine', gain: 0.12 }),
    ]),
  }),
  Object.freeze({
    id: 'kitchen-strong',
    label: 'Cozinha forte',
    description: 'Três chamadas marcantes, indicada para cozinhas mais barulhentas.',
    tones: Object.freeze([
      Object.freeze({ frequency: 720, start: 0, duration: 0.34, type: 'triangle', gain: 0.28 }),
      Object.freeze({ frequency: 920, start: 0.48, duration: 0.34, type: 'triangle', gain: 0.30 }),
      Object.freeze({ frequency: 720, start: 0.96, duration: 0.44, type: 'triangle', gain: 0.32 }),
    ]),
  }),
  Object.freeze({
    id: 'double-alert',
    label: 'Duplo alerta',
    description: 'Dois blocos de tons rápidos com pausa curta entre eles.',
    tones: Object.freeze([
      Object.freeze({ frequency: 784, start: 0, duration: 0.24, type: 'sine', gain: 0.23 }),
      Object.freeze({ frequency: 988, start: 0.18, duration: 0.24, type: 'sine', gain: 0.24 }),
      Object.freeze({ frequency: 784, start: 0.70, duration: 0.24, type: 'sine', gain: 0.23 }),
      Object.freeze({ frequency: 988, start: 0.88, duration: 0.24, type: 'sine', gain: 0.24 }),
    ]),
  }),
  Object.freeze({
    id: 'long-call',
    label: 'Chamado longo',
    description: 'Tons mais sustentados para ambientes com ruído constante.',
    tones: Object.freeze([
      Object.freeze({ frequency: 620, start: 0, duration: 0.72, type: 'triangle', gain: 0.22 }),
      Object.freeze({ frequency: 780, start: 0.28, duration: 0.72, type: 'sine', gain: 0.18 }),
      Object.freeze({ frequency: 700, start: 0.96, duration: 0.52, type: 'triangle', gain: 0.24 }),
    ]),
  }),
  Object.freeze({
    id: 'classic',
    label: 'Clássico',
    description: 'Bip curto semelhante ao aviso usado anteriormente.',
    tones: Object.freeze([
      Object.freeze({ frequency: 784, start: 0, duration: 0.20, type: 'sine', gain: 0.18 }),
      Object.freeze({ frequency: 988, start: 0.16, duration: 0.20, type: 'sine', gain: 0.18 }),
    ]),
  }),
])

export const KITCHEN_ALERT_VOLUME_OPTIONS = Object.freeze([
  Object.freeze({ id: 'normal', label: 'Normal', scale: 0.60 }),
  Object.freeze({ id: 'high', label: 'Alto', scale: 0.82 }),
  Object.freeze({ id: 'max', label: 'Máximo', scale: 1 }),
])

export const ADMIN_KITCHEN_ALERT_DEFAULTS = Object.freeze({ profile: 'bell', volume: 'high' })
export const TV_KITCHEN_ALERT_DEFAULTS = Object.freeze({ profile: 'kitchen-strong', volume: 'max' })

const profileById = new Map(KITCHEN_ALERT_PROFILES.map((profile) => [profile.id, profile]))
const volumeById = new Map(KITCHEN_ALERT_VOLUME_OPTIONS.map((volume) => [volume.id, volume]))

export function getKitchenAlertProfile(value, fallback = ADMIN_KITCHEN_ALERT_DEFAULTS.profile) {
  return profileById.get(String(value || '')) || profileById.get(fallback) || KITCHEN_ALERT_PROFILES[0]
}

export function getKitchenAlertVolume(value, fallback = ADMIN_KITCHEN_ALERT_DEFAULTS.volume) {
  return volumeById.get(String(value || '')) || volumeById.get(fallback) || KITCHEN_ALERT_VOLUME_OPTIONS[0]
}
