import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-sync-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')
const cacheDir = path.join(testDir, 'transactions')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { monthKeysBetween } = await import('./monthUtils.js')
const { earliestMonthKey } = await import('./cacheCoverage.js')
const {
  startHistoricalSync,
  maybeStartHistoricalSyncOnUnlock,
  isHistoricalSyncRunning,
  resolveSyncMonthRange,
  getHistoricalSyncStatus
} = await import('./historicalSync.js')
const {
  updateSyncState,
  defaultSyncState,
  hasMonth,
  getMonth
} = await import('./transactionCache.js')

const originalFetch = globalThis.fetch

describe('historicalSync', () => {
  before(() => {
    initVault('sync-test-passphrase')
    updateVault((v) => {
      v.monzo.refreshToken = 'refresh_test'
    })
  })

  after(() => {
    globalThis.fetch = originalFetch
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('does not start when Monzo is not connected', () => {
    const result = startHistoricalSync({ trigger: 'manual' })
    assert.equal(result.started, false)
    assert.equal(result.reason, 'not_connected')
    assert.equal(isHistoricalSyncRunning(), false)
  })

  it('skips unlock resume when sync already completed', () => {
    updateVault((v) => {
      v.monzo.accountId = 'acc_linked'
    })
    updateSyncState({ ...defaultSyncState(), status: 'completed' })
    const result = maybeStartHistoricalSyncOnUnlock()
    assert.equal(result.started, false)
    assert.equal(result.reason, 'already_completed')
  })

  it('returns empty when start is after end (old sync bug)', () => {
    assert.deepEqual(monthKeysBetween('2026-06', '2026-05'), [])
  })

  it('includes current month through account creation when end is June 2026', () => {
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.accountCreatedAt = '2024-03-15T12:00:00Z'
      v.monzo.historyStartMonth = '2026-06'
    })

    const { startKey, endKey, monthKeys } = resolveSyncMonthRange({ endKey: '2026-06' })

    assert.equal(endKey, '2026-06')
    assert.equal(startKey, '2024-03')
    assert.ok(monthKeys.length > 1)
    assert.equal(monthKeys[0], '2026-06')
    assert.equal(monthKeys[monthKeys.length - 1], '2024-03')
    assert.ok(monthKeys.includes('2026-05'))
    assert.ok(monthKeys.includes('2026-04'))
  })

  it('keeps the earliest month when merging anchors', () => {
    const merged = earliestMonthKey('2024-06', '2024-04', '2024-05')
    assert.equal(merged, '2024-04')
  })

  it('caches multiple months newest-first before verification stops sync', async () => {
    const fetchCalls = []

    const sinceForMonth = (year, month) => new Date(year, month, 1).toISOString()

    updateVault((v) => {
      v.monzo.accountId = 'acc_sync'
      v.monzo.refreshToken = 'refresh_sync'
      v.monzo.accessToken = 'access_sync'
      v.monzo.expiresAt = Date.now() + 3_600_000
      v.monzo.accountCreatedAt = '2026-04-01T00:00:00Z'
    })
    updateSyncState({ ...defaultSyncState() })

    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }

    globalThis.fetch = async (url) => {
      const urlStr = String(url)

      if (urlStr.includes('/accounts')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              accounts: [
                {
                  id: 'acc_sync',
                  type: 'uk_retail',
                  created: '2026-04-01T00:00:00Z'
                }
              ]
            })
        }
      }

      if (urlStr.includes('/transactions')) {
        fetchCalls.push(urlStr)
        const params = new URL(urlStr).searchParams
        const since = params.get('since') || ''

        if (since === sinceForMonth(2026, 5)) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                transactions: [
                  {
                    id: 'tx_jun',
                    created: '2026-06-10T12:00:00Z',
                    amount: -1000
                  }
                ]
              })
          }
        }
        if (since === sinceForMonth(2026, 4)) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                transactions: [
                  {
                    id: 'tx_may',
                    created: '2026-05-10T12:00:00Z',
                    amount: -2000
                  }
                ]
              })
          }
        }
        if (since === sinceForMonth(2026, 3)) {
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

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ transactions: [] })
        }
      }

      if (urlStr.includes('/oauth2/token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: 'access_sync',
              expires_in: 3600
            })
        }
      }

      throw new Error(`Unexpected fetch: ${urlStr}`)
    }

    const started = startHistoricalSync({ trigger: 'manual' })
    assert.equal(started.started, true)

    for (let i = 0; i < 50 && isHistoricalSyncRunning(); i++) {
      await new Promise((r) => setTimeout(r, 50))
    }

    assert.equal(hasMonth('2026-06'), true)
    assert.equal(hasMonth('2026-05'), true)
    assert.equal(hasMonth('2026-04'), false)

    assert.equal(getMonth('2026-06').transactions[0].id, 'tx_jun')
    assert.equal(getMonth('2026-05').transactions[0].id, 'tx_may')

    const status = getHistoricalSyncStatus()
    assert.equal(status.stoppedReason, 'verification_required')
    assert.equal(status.cachedMonthCount, 2)
    assert.ok(fetchCalls.length >= 2)

    globalThis.fetch = originalFetch
  })
})
