import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-analytics-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { upsertMonth, updateSyncState } = await import('./transactionCache.js')
const { getSummary } = await import('./analytics.js')
const { formatMonthKey } = await import('./monthUtils.js')

const originalFetch = globalThis.fetch

function sampleTx(id, created, amount) {
  return {
    id,
    created,
    amount,
    category: 'general',
    description: `tx ${id}`
  }
}

function cacheYtdMonths() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  for (let m = 0; m <= month; m++) {
    const monthKey = formatMonthKey(year, m)
    upsertMonth(monthKey, [
      sampleTx(`tx_${monthKey}`, `${monthKey}-15T12:00:00Z`, -5000)
    ])
  }
}

function blockedTransactionsFetch() {
  return async (url) => {
    const target = String(url)
    if (target.includes('/pots')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ pots: [] })
      }
    }
    if (target.includes('/transactions')) {
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
  const startKey = formatMonthKey(year, 0)
  updateSyncState({ oldestMonth: startKey, status: 'completed' })
  updateVault((v) => {
    v.monzo.accountCreatedAt = `${year}-01-01T00:00:00Z`
    v.monzo.historyStartMonth = startKey
  })
}

describe('getSummary YTD cache-first', () => {
  before(() => {
    initVault('analytics-cache-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
    })

    cacheYtdMonths()
    seedHistoryAnchors()
    globalThis.fetch = blockedTransactionsFetch()
  })

  after(() => {
    globalThis.fetch = originalFetch
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('returns YTD from cache without incomplete when live API is blocked', async () => {
    const summary = await getSummary('ytd')
    assert.equal(summary.incomplete, false)
    assert.equal(summary.incompleteReason, null)
    assert.ok(summary.transactionCount > 0)
  })

  it('marks YTD incomplete when a month has no cache coverage', async () => {
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

    const summary = await getSummary('ytd')
    assert.equal(summary.incomplete, true)
    assert.ok(summary.incompleteReason)

    upsertMonth(gapKey, [
      sampleTx(`tx_${gapKey}`, `${gapKey}-15T12:00:00Z`, -5000)
    ])
  })
})
