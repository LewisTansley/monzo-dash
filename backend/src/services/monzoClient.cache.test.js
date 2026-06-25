import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-cache-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { upsertMonth, updateSyncState } = await import('./transactionCache.js')
const { fetchMonthTransactionsWithCache, getTransactionMonthFeed } = await import('./monzoClient.js')

const originalFetch = globalThis.fetch
let transactionFetchCount = 0

describe('fetchMonthTransactionsWithCache cache-first', () => {
  before(() => {
    initVault('cache-test-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
    })

    upsertMonth('2024-05', [
      {
        id: 'tx_cached_may',
        created: '2024-05-10T10:00:00Z',
        amount: -2500,
        category: 'groceries',
        description: 'Cached May'
      }
    ])

    upsertMonth('2024-04', [
      {
        id: 'tx_cached_apr',
        created: '2024-04-10T10:00:00Z',
        amount: -1500,
        category: 'groceries',
        description: 'Cached April'
      }
    ])

    updateSyncState({ oldestMonth: '2024-06', status: 'completed' })
    updateVault((v) => {
      v.monzo.historyStartMonth = '2024-06'
      v.monzo.accountCreatedAt = '2024-01-01T00:00:00Z'
    })

    globalThis.fetch = async (url) => {
      if (String(url).includes('/transactions')) {
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
      throw new Error(`Unexpected fetch: ${url}`)
    }
  })

  after(() => {
    globalThis.fetch = originalFetch
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('returns cached data for completed months without calling Monzo', async () => {
    transactionFetchCount = 0
    const result = await fetchMonthTransactionsWithCache('acc_test', 2024, 4)
    assert.equal(transactionFetchCount, 0)
    assert.equal(result.fromCache, true)
    assert.equal(result.transactions.length, 1)
    assert.equal(result.transactions[0].id, 'tx_cached_may')
  })

  it('serves cached April and May when historyStartMonth is later', async () => {
    transactionFetchCount = 0

    const april = await fetchMonthTransactionsWithCache('acc_test', 2024, 3)
    assert.equal(april.fromCache, true)
    assert.equal(april.transactions[0].id, 'tx_cached_apr')

    const may = await fetchMonthTransactionsWithCache('acc_test', 2024, 4)
    assert.equal(may.fromCache, true)
    assert.equal(may.transactions[0].id, 'tx_cached_may')

    assert.equal(transactionFetchCount, 0)

    const feed = await getTransactionMonthFeed({ month: '2024-04' })
    assert.equal(feed.fromCache, true)
    assert.equal(feed.transactions.length, 1)
    assert.equal(feed.transactions[0].id, 'tx_cached_apr')
    assert.equal(feed.cacheGap, false)
  })

  it('calls Monzo for the current month even when older months are cached', async () => {
    transactionFetchCount = 0
    const now = new Date()
    await assert.rejects(
      () => fetchMonthTransactionsWithCache('acc_test', now.getFullYear(), now.getMonth()),
      /Verification required/
    )
    assert.ok(transactionFetchCount > 0)
  })
})
