import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-feed-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { upsertMonth, updateSyncState } = await import('./transactionCache.js')
const { getTransactionMonthFeed } = await import('./monzoClient.js')

const originalFetch = globalThis.fetch

describe('getTransactionMonthFeed cache fallback', () => {
  before(() => {
    initVault('feed-test-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
      v.monzo.accountCreatedAt = '2023-01-01T00:00:00Z'
      v.monzo.historyStartMonth = '2023-01'
    })
    updateSyncState({ oldestMonth: '2023-01', status: 'completed' })

    upsertMonth('2023-01', [
      {
        id: 'tx_cached',
        created: '2023-01-10T10:00:00Z',
        amount: -1000,
        category: 'groceries',
        description: 'Cached shop'
      }
    ])

    globalThis.fetch = async (url) => {
      if (String(url).includes('/transactions')) {
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
      if (String(url).includes('/pots')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ pots: [] })
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

  it('serves cached month when live API requires verification', async () => {
    const feed = await getTransactionMonthFeed({ month: '2023-01' })
    assert.equal(feed.fromCache, true)
    assert.equal(feed.transactions.length, 1)
    assert.equal(feed.transactions[0].id, 'tx_cached')
    assert.equal(feed.verificationRequired, false)
  })

  it('continues pagination into cached older months', async () => {
    const feed = await getTransactionMonthFeed({ month: '2023-02' })
    assert.equal(feed.verificationRequired, false)
    assert.equal(feed.cacheGap, false)
    assert.equal(feed.hasMore, true)
    assert.equal(feed.nextMonth, '2023-01')
  })
})

describe('getTransactionMonthFeed account start floor', () => {
  const floorTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-feed-floor-'))

  before(() => {
    process.env.VAULT_PATH = path.join(floorTestDir, 'vault.enc')
    initVault('feed-floor-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
      v.monzo.accountCreatedAt = '2024-03-15T12:00:00Z'
      v.monzo.historyStartMonth = '2024-06'
    })
    updateSyncState({ oldestMonth: '2024-06', status: 'completed' })

    upsertMonth('2024-01', [
      {
        id: 'tx_pre_account',
        created: '2024-01-10T10:00:00Z',
        amount: -1000,
        category: 'groceries',
        description: 'Pre-account cached'
      }
    ])
    upsertMonth('2024-02', [
      {
        id: 'tx_pre_account_feb',
        created: '2024-02-10T10:00:00Z',
        amount: -500,
        category: 'groceries',
        description: 'Pre-account cached Feb'
      }
    ])

    globalThis.fetch = async (url) => {
      if (String(url).includes('/transactions')) {
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
      if (String(url).includes('/pots')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ pots: [] })
        }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }
  })

  after(() => {
    globalThis.fetch = originalFetch
    lockVault()
    fs.rmSync(floorTestDir, { recursive: true, force: true })
  })

  it('does not serve cache for months before account start', async () => {
    const jan = await getTransactionMonthFeed({ month: '2024-01' })
    assert.equal(jan.fromCache, true)
    assert.equal(jan.transactions.length, 0)

    const feb = await getTransactionMonthFeed({ month: '2024-02' })
    assert.equal(feb.fromCache, true)
    assert.equal(feb.transactions.length, 0)
  })

  it('stops pagination at account start month', async () => {
    const feed = await getTransactionMonthFeed({ month: '2024-03' })
    assert.equal(feed.hasMore, false)
    assert.equal(feed.nextMonth, null)
  })
})
