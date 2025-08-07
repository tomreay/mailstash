export const DELAY_PRESETS = [
  { hours: 0, label: 'Immediately' },
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '1 day' },
  { hours: 168, label: '1 week' },
] as const

export const AGE_PRESETS = [
  { months: 1, label: '1 month' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 18, label: '18 months' },
] as const

export const POLLING_INTERVAL = 2000
export const SUCCESS_MESSAGE_DURATION = 3000