import { getVaultData } from './vault.js'
import { config } from '../config.js'

const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function defaultRunLimit() {
  return {
    mode: 'once',
    max: 3,
    countAttempts: 'all'
  }
}

export function defaultAutoTrigger() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    enabled: false,
    mode: 'conditions',
    schedule: {
      type: 'weekly',
      time: '09:00',
      daysOfWeek: [5],
      dayOfMonth: 1,
      intervalDays: 14,
      anchorDate: today
    },
    frequency: 'once_per_day',
    runLimit: defaultRunLimit()
  }
}

export function normalizeRunLimit(runLimit) {
  const defaults = defaultRunLimit()
  if (!runLimit) return { ...defaults }

  const mode = ['once', 'count', 'unlimited'].includes(runLimit.mode)
    ? runLimit.mode
    : defaults.mode

  return {
    mode,
    max: Math.max(2, Number(runLimit.max) || defaults.max),
    countAttempts: runLimit.countAttempts === 'successful' ? 'successful' : 'all'
  }
}

export function normalizeAutoTrigger(autoTrigger) {
  const defaults = defaultAutoTrigger()
  if (!autoTrigger) return defaults

  return {
    enabled: autoTrigger.enabled === true,
    mode: autoTrigger.mode || defaults.mode,
    schedule: {
      ...defaults.schedule,
      ...(autoTrigger.schedule || {})
    },
    frequency: autoTrigger.frequency || defaults.frequency,
    runLimit: normalizeRunLimit(autoTrigger.runLimit)
  }
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    dayOfWeek: WEEKDAY_MAP[parts.weekday] ?? 0
  }
}

function parseScheduleTime(timeStr) {
  const [hourPart, minutePart] = (timeStr || '09:00').split(':')
  return {
    hour: parseInt(hourPart, 10) || 0,
    minute: parseInt(minutePart, 10) || 0
  }
}

function isTimeReached(parts, schedule) {
  const { hour, minute } = parseScheduleTime(schedule.time)
  if (parts.hour > hour) return true
  if (parts.hour === hour && parts.minute >= minute) return true
  return false
}

function daysBetween(anchorDate, dateKey) {
  const [ay, am, ad] = anchorDate.split('-').map(Number)
  const [cy, cm, cd] = dateKey.split('-').map(Number)
  const anchor = Date.UTC(ay, am - 1, ad)
  const current = Date.UTC(cy, cm - 1, cd)
  return Math.floor((current - anchor) / (24 * 60 * 60 * 1000))
}

export function isWithinScheduleWindow(autoTrigger, now, timezone) {
  const trigger = normalizeAutoTrigger(autoTrigger)
  if (!trigger.enabled) return false
  if (trigger.mode === 'conditions') return true

  const schedule = trigger.schedule
  const parts = getZonedParts(now, timezone)
  if (!isTimeReached(parts, schedule)) return false

  switch (schedule.type) {
    case 'daily':
      return true
    case 'weekly': {
      const days = schedule.daysOfWeek || []
      return days.length === 0 || days.includes(parts.dayOfWeek)
    }
    case 'monthly':
      return parseInt(parts.day, 10) === (schedule.dayOfMonth || 1)
    case 'interval_days': {
      const anchor = schedule.anchorDate || parts.dateKey
      const interval = schedule.intervalDays || 1
      const days = daysBetween(anchor, parts.dateKey)
      return days >= 0 && days % interval === 0
    }
    default:
      return false
  }
}

export function getWindowKey(autoTrigger, now, timezone) {
  const trigger = normalizeAutoTrigger(autoTrigger)
  const parts = getZonedParts(now, timezone)

  if (trigger.mode === 'conditions') {
    return parts.dateKey
  }

  const schedule = trigger.schedule
  switch (schedule.type) {
    case 'daily':
    case 'weekly':
      return parts.dateKey
    case 'monthly':
      return `${parts.year}-${parts.month}`
    case 'interval_days': {
      const anchor = schedule.anchorDate || parts.dateKey
      const interval = schedule.intervalDays || 1
      const days = daysBetween(anchor, parts.dateKey)
      const period = days >= 0 ? Math.floor(days / interval) : 0
      return `${anchor}-p${period}`
    }
    default:
      return parts.dateKey
  }
}

export function getTriggerStateKey(autoTrigger, now, timezone) {
  const trigger = normalizeAutoTrigger(autoTrigger)
  const parts = getZonedParts(now, timezone)
  if (trigger.frequency === 'once_per_day') return parts.dateKey
  return getWindowKey(trigger, now, timezone)
}

export function getRunLimitState(autoTrigger, triggerState, now, timezone) {
  const trigger = normalizeAutoTrigger(autoTrigger)
  const stateKey = getTriggerStateKey(trigger, now, timezone)
  const state = triggerState || {}
  const isNewWindow = state.lastWindowKey !== stateKey
  const attemptCount = isNewWindow ? 0 : (state.attemptCount || 0)
  const transferCount = isNewWindow ? 0 : (state.transferCount || 0)

  return {
    stateKey,
    isNewWindow,
    attemptCount,
    transferCount,
    runLimit: trigger.runLimit
  }
}

function shouldIncrementAttemptCount(runLimit, runStatus) {
  if (runLimit.mode === 'once' || runLimit.mode === 'unlimited') {
    return true
  }
  if (runLimit.mode === 'count') {
    if (runLimit.countAttempts === 'successful') {
      return runStatus === 'success'
    }
    return true
  }
  return false
}

export function buildTriggerStateRecord(autoTrigger, triggerState, now, timezone, runStatus) {
  const { stateKey, isNewWindow, attemptCount, transferCount, runLimit } = getRunLimitState(
    autoTrigger,
    triggerState,
    now,
    timezone
  )

  let nextAttemptCount = attemptCount
  if (shouldIncrementAttemptCount(runLimit, runStatus)) {
    nextAttemptCount += 1
  }

  let nextTransferCount = transferCount
  if (runStatus === 'success' || runStatus === 'error') {
    nextTransferCount += 1
  }

  return {
    lastWindowKey: stateKey,
    attemptCount: nextAttemptCount,
    transferCount: nextTransferCount,
    lastAttemptAt: now.toISOString()
  }
}

export function getTransferDedupeId(automationId, autoTrigger, triggerState, now, timezone) {
  const trigger = normalizeAutoTrigger(autoTrigger)
  const { stateKey, transferCount, runLimit } = getRunLimitState(
    autoTrigger,
    triggerState,
    now,
    timezone
  )

  if (runLimit.mode === 'once') {
    return `${automationId}-${now.toISOString().slice(0, 10)}`
  }

  return `${automationId}-${stateKey}-${transferCount + 1}`
}

export function shouldAutoRun(entity, triggerState, now, timezone) {
  if (!entity?.enabled) return false

  const trigger = normalizeAutoTrigger(entity.autoTrigger)
  if (!trigger.enabled) return false

  if (trigger.mode === 'schedule' || trigger.mode === 'schedule_and_conditions') {
    if (!isWithinScheduleWindow(trigger, now, timezone)) return false
  }

  const { isNewWindow, attemptCount, runLimit } = getRunLimitState(
    trigger,
    triggerState,
    now,
    timezone
  )

  if (runLimit.mode === 'unlimited') return true
  if (isNewWindow) return true
  if (runLimit.mode === 'once') return false
  if (runLimit.mode === 'count') return attemptCount < runLimit.max

  return false
}

export function evaluateEligibleAutomations(
  now = new Date(),
  timezone = config.autoTriggerTimezone
) {
  const vault = getVaultData()
  return (vault.automations || []).filter((automation) =>
    shouldAutoRun(
      automation,
      vault.automationTriggerState?.[automation.id],
      now,
      timezone
    )
  )
}

export function evaluateEligibleGroups(
  now = new Date(),
  timezone = config.autoTriggerTimezone
) {
  const vault = getVaultData()
  return (vault.automationGroups || []).filter((group) =>
    shouldAutoRun(
      group,
      vault.automationGroupTriggerState?.[group.id],
      now,
      timezone
    )
  )
}
