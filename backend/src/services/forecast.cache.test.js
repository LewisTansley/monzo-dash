import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-forecast-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { upsertMonth, updateSyncState } = await import('./transactionCache.js')
const { getForecast } = await import('./forecast.js')
const { formatMonthKey } = await import('./monthUtils.js')

const originalFetch = globalThis.fetch
let transactionFetchCount = 0

function sampleTx(id, created, amount) {
  return {
    id,
    created,
    amount,
    category: 'general',
    description: `tx ${id}`
  }
}

function cacheHistoricalMonths() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  for (let m = 0; m <= 11; m++) {
    const monthKey = formatMonthKey(year - 1, m)
    upsertMonth(monthKey, [
      sampleTx(`tx_${monthKey}`, `${monthKey}-15T12:00:00Z`, m % 2 === 0 ? -10000 : 12000)
    ])
  }

  for (let m = 0; m < month; m++) {
    const monthKey = formatMonthKey(year, m)
    upsertMonth(monthKey, [
      sampleTx(`tx_${monthKey}`, `${monthKey}-15T12:00:00Z`, -5000)
    ])
  }
}

function blockedTransactionsFetch() {
  return async (url) => {
    const target = String(url)
    if (target.includes('/balance')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ balance: 50000, spend_today: 0 })
      }
    }
    if (target.includes('/pots')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ pots: [] })
      }
    }
    if (target.includes('/transactions')) {
      transactionFetchCount += 1
      return {
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            code: 'verification_required',
            message: 'Verification required'
          })
      }
    }
    throw new Error(`Unexpected fetch: ${target}`)
  }
}

function seedHistoryAnchors() {
  const now = new Date()
  const year = now.getFullYear()
  const startKey = formatMonthKey(year - 1, 0)
  updateSyncState({ oldestMonth: startKey, status: 'completed' })
  updateVault((v) => {
    v.monzo.accountCreatedAt = `${year - 1}-01-01T00:00:00Z`
    v.monzo.historyStartMonth = startKey
  })
}

describe('getForecast cache-first integration', () => {
  before(() => {
    initVault('forecast-cache-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
    })

    cacheHistoricalMonths()
    seedHistoryAnchors()
    globalThis.fetch = blockedTransactionsFetch()
  })

  after(() => {
    globalThis.fetch = originalFetch
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('returns forecast from cache without incomplete flag when live API is blocked', async () => {
    transactionFetchCount = 0
    const forecast = await getForecast()
    assert.equal(forecast.incomplete, false)
    assert.equal(forecast.incompleteReason, null)
    assert.equal(forecast.balance, 50000)
    assert.equal(forecast.monthlyProjections.length, 12)
    assert.equal(forecast.horizons[12].projectedBalance, forecast.balance + forecast.horizons[12].projectedNet)
  })

  it('uses cached months and only calls Monzo once for the current month', async () => {
    transactionFetchCount = 0
    await getForecast()
    assert.equal(transactionFetchCount, 1)
  })

  it('survives network failures when cache covers historical months', async () => {
    globalThis.fetch = async (url) => {
      const target = String(url)
      if (target.includes('/balance')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ balance: 25000, spend_today: 0 })
        }
      }
      if (target.includes('/pots')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ pots: [] })
        }
      }
      if (target.includes('/transactions')) {
        throw new TypeError('fetch failed')
      }
      throw new Error(`Unexpected fetch: ${target}`)
    }

    const forecast = await getForecast()
    assert.equal(forecast.incomplete, false)
    assert.equal(forecast.balance, 25000)
    assert.equal(forecast.monthlyProjections.length, 12)

    globalThis.fetch = blockedTransactionsFetch()
  })

  it('does not mark incomplete when older cache covers a missing baseline month', async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const missingBaselineKey = formatMonthKey(year - 1, month)
    const olderBaselineKey = formatMonthKey(year - 2, month)

    const missingPath = path.join(testDir, 'transactions', `${missingBaselineKey}.enc`)
    if (fs.existsSync(missingPath)) {
      fs.unlinkSync(missingPath)
    }

    upsertMonth(olderBaselineKey, [
      sampleTx(`tx_${olderBaselineKey}`, `${olderBaselineKey}-15T12:00:00Z`, -80000)
    ])

    const forecast = await getForecast()
    assert.ok(forecast.missingMonths.includes(missingBaselineKey))
    assert.equal(forecast.incomplete, false)

    upsertMonth(missingBaselineKey, [
      sampleTx(`tx_${missingBaselineKey}`, `${missingBaselineKey}-15T12:00:00Z`, -10000)
    ])
  })

  it('marks incomplete when a historical month has no cache coverage', async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    if (month === 0) {
      return
    }

    const gapKey = formatMonthKey(year, month - 1)
    const gapPath = path.join(testDir, 'transactions', `${gapKey}.enc`)
    if (fs.existsSync(gapPath)) {
      fs.unlinkSync(gapPath)
    }

    const forecast = await getForecast()
    assert.equal(forecast.incomplete, true)
    assert.ok(forecast.incompleteReason)

    cacheHistoricalMonths()
    globalThis.fetch = blockedTransactionsFetch()
  })
})
