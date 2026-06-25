import { getSyncState, hasMonth, getCacheSummary } from './transactionCache.js'
import { currentMonthKey, formatMonthKey, monthKeysBetween } from './monthUtils.js'
import { getVaultData } from './vault.js'

function monthKeyFromIso(iso) {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return formatMonthKey(d.getFullYear(), d.getMonth())
}

export function earliestMonthKey(...keys) {
  const candidates = keys.filter(Boolean)
  if (!candidates.length) return null
  return [...candidates].sort()[0]
}

export function getAccountCreatedMonthKey() {
  try {
    return monthKeyFromIso(getVaultData().monzo?.accountCreatedAt)
  } catch {
    return null
  }
}

export function isBeforeAccountStart(monthKey, accountCreatedMonth = getAccountCreatedMonthKey()) {
  return Boolean(accountCreatedMonth && monthKey < accountCreatedMonth)
}

export function getHistoryStartMonthKey() {
  let vaultMonth = null
  try {
    vaultMonth = getVaultData().monzo?.historyStartMonth?.trim() || null
  } catch {
    // vault locked
  }

  const { oldestCachedMonth } = getCacheSummary()
  return earliestMonthKey(
    getSyncState().oldestMonth,
    vaultMonth,
    oldestCachedMonth
  )
}

export function isRequiredMonth(monthKey, {
  accountCreatedMonth = getAccountCreatedMonthKey(),
  historyStartMonth = getHistoryStartMonthKey(),
  endMonth = currentMonthKey()
} = {}) {
  if (!monthKey) return false
  if (monthKey > endMonth) return false

  if (accountCreatedMonth && monthKey < accountCreatedMonth) {
    return false
  }

  if (historyStartMonth) {
    if (monthKey < historyStartMonth) return false
    return true
  }

  const { oldestCachedMonth } = getCacheSummary()
  if (oldestCachedMonth && monthKey < oldestCachedMonth) {
    return false
  }

  return true
}

export function getMissingRequiredMonths(
  endKey = currentMonthKey(),
  { rangeStart = null } = {}
) {
  const historyStart = getHistoryStartMonthKey()
  if (!historyStart) return []

  let start = rangeStart || historyStart
  if (historyStart > start) start = historyStart
  if (start > endKey) return []

  const nowKey = currentMonthKey()

  return monthKeysBetween(start, endKey).filter(
    (key) =>
      key !== nowKey &&
      isRequiredMonth(key, { endMonth: endKey }) &&
      !hasMonth(key)
  )
}

export function isCacheCoverageComplete(endKey = currentMonthKey()) {
  return getMissingRequiredMonths(endKey).length === 0
}

export function filterRealCacheGaps(failedMonthKeys) {
  const list = Array.isArray(failedMonthKeys) ? failedMonthKeys : []
  return list.filter((key) => isRequiredMonth(key))
}

export function monthHasCoverage(monthKey, liveBlocked) {
  if (!isRequiredMonth(monthKey)) return true
  if (hasMonth(monthKey)) return true
  if (!liveBlocked) return true
  return false
}
