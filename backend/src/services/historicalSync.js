import {
  fetchTransactionsForMonth,
  isVerificationRequired,
  ensureAccountCreatedAt
} from './monzoClient.js'
import {
  getSyncState,
  updateSyncState,
  upsertMonth,
  hasMonth,
  getCacheSummary,
  defaultSyncState
} from './transactionCache.js'
import { getVaultData, getVaultStatus, updateVault } from './vault.js'
import {
  currentMonthKey,
  monthKeysBetween,
  monthKeyMonthsAgo
} from './monthUtils.js'
import {
  isCacheCoverageComplete,
  getMissingRequiredMonths,
  getHistoryStartMonthKey,
  getAccountCreatedMonthKey,
  earliestMonthKey
} from './cacheCoverage.js'

const MAX_SYNC_MONTHS = 120
const SYNC_LOOKBACK_MONTHS = 24

let syncRunning = false

export function isHistoricalSyncRunning() {
  return syncRunning
}

export function resolveSyncMonthRange({ endKey = currentMonthKey() } = {}) {
  const vault = getVaultData()
  const { oldestCachedMonth } = getCacheSummary()
  const accountMonth = getAccountCreatedMonthKey()
  const lookbackStart = monthKeyMonthsAgo(endKey, SYNC_LOOKBACK_MONTHS - 1)

  let startKey = earliestMonthKey(
    accountMonth,
    lookbackStart,
    oldestCachedMonth,
    vault.monzo?.historyStartMonth?.trim() || null
  )
  if (!startKey) startKey = lookbackStart
  if (startKey > endKey) startKey = endKey

  const chronological = monthKeysBetween(startKey, endKey)
  const capped =
    chronological.length > MAX_SYNC_MONTHS
      ? chronological.slice(-MAX_SYNC_MONTHS)
      : chronological

  const rangeStart = capped.length ? capped[0] : startKey
  const rangeEnd = capped.length ? capped[capped.length - 1] : endKey

  return {
    startKey: rangeStart,
    endKey: rangeEnd,
    monthKeys: [...capped].reverse()
  }
}

async function runHistoricalSync({ trigger } = {}) {
  const accountId = getVaultData().monzo.accountId
  const state = getSyncState()

  updateSyncState({
    status: 'running',
    startedAt: state.startedAt || new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    stoppedReason: null,
    syncRangeStart: null,
    syncRangeEnd: null,
    accountId,
    trigger: trigger || state.trigger || 'unknown'
  })

  try {
    await ensureAccountCreatedAt()

    const { startKey, endKey, monthKeys } = resolveSyncMonthRange()
    const accountMonth = getAccountCreatedMonthKey()

    updateSyncState({
      syncRangeStart: startKey,
      syncRangeEnd: endKey
    })

    let monthsSynced = 0
    let oldestSynced = null
    let stoppedReason = null

    for (const monthKey of monthKeys) {
      if (accountMonth && monthKey < accountMonth) {
        continue
      }

      if (hasMonth(monthKey)) {
        monthsSynced += 1
        oldestSynced = earliestMonthKey(oldestSynced, monthKey)
        continue
      }

      const parsed = monthKey.match(/^(\d{4})-(\d{2})$/)
      if (!parsed) continue
      const year = Number(parsed[1])
      const month = Number(parsed[2]) - 1

      try {
        const transactions = await fetchTransactionsForMonth(accountId, year, month)
        upsertMonth(monthKey, transactions)
        monthsSynced += 1
        oldestSynced = earliestMonthKey(oldestSynced, monthKey)
        updateSyncState({
          monthsSynced,
          oldestMonth: earliestMonthKey(getSyncState().oldestMonth, oldestSynced)
        })

        if (!transactions.length && accountMonth && monthKey === accountMonth) {
          break
        }
      } catch (err) {
        if (isVerificationRequired(err)) {
          stoppedReason = 'verification_required'
          break
        }
        throw err
      }
    }

    const vault = getVaultData()
    const finalOldest = earliestMonthKey(
      oldestSynced,
      getSyncState().oldestMonth,
      getCacheSummary().oldestCachedMonth,
      vault.monzo.historyStartMonth
    )

    updateSyncState({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      monthsSynced,
      oldestMonth: finalOldest,
      lastError: stoppedReason,
      stoppedReason
    })

    if (finalOldest) {
      updateVault((v) => {
        v.monzo.historyStartMonth = finalOldest
      })
    }
  } catch (err) {
    updateSyncState({
      status: 'failed',
      finishedAt: new Date().toISOString(),
      lastError: err.message,
      stoppedReason: null
    })
  } finally {
    syncRunning = false
  }
}

export function startHistoricalSync({ trigger } = {}) {
  if (syncRunning) return { started: false, reason: 'already_running' }
  if (!getVaultStatus().isMonzoConnected) {
    return { started: false, reason: 'not_connected' }
  }

  const state = getSyncState()
  if (state.status === 'running') {
    return { started: false, reason: 'already_running' }
  }

  if (trigger === 'oauth' || trigger === 'manual') {
    updateSyncState({
      ...defaultSyncState(),
      trigger,
      accountId: getVaultData().monzo.accountId
    })
  } else if (state.status === 'completed') {
    return { started: false, reason: 'already_completed' }
  }

  syncRunning = true
  runHistoricalSync({ trigger }).catch(() => {
    syncRunning = false
  })

  return { started: true }
}

export function maybeStartHistoricalSyncOnUnlock() {
  if (!getVaultStatus().isMonzoConnected) return { started: false }

  const state = getSyncState()
  if (state.status === 'completed') {
    return { started: false, reason: 'already_completed' }
  }
  if (state.status === 'running' && syncRunning) {
    return { started: false, reason: 'already_running' }
  }

  return startHistoricalSync({ trigger: 'vault_unlock' })
}

export function getHistoricalSyncStatus() {
  const state = getSyncState()
  const summary = getCacheSummary()
  return {
    ...state,
    running: syncRunning || state.status === 'running',
    ...summary,
    historyStartMonth: getHistoryStartMonthKey(),
    cacheCoverageComplete: isCacheCoverageComplete(),
    missingRequiredMonths: getMissingRequiredMonths()
  }
}
