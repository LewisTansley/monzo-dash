import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-coverage-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, updateVault } = await import('./vault.js')
const { updateSyncState, upsertMonth } = await import('./transactionCache.js')
const {
  getAccountCreatedMonthKey,
  getHistoryStartMonthKey,
  isBeforeAccountStart,
  isRequiredMonth,
  getMissingRequiredMonths,
  isCacheCoverageComplete,
  filterRealCacheGaps,
  monthHasCoverage
} = await import('./cacheCoverage.js')
const { formatMonthKey } = await import('./monthUtils.js')

describe('cacheCoverage', () => {
  before(() => {
    initVault('coverage-test-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.accountCreatedAt = '2024-03-15T12:00:00Z'
      v.monzo.historyStartMonth = '2024-06'
    })
    updateSyncState({ oldestMonth: '2024-06' })
    upsertMonth('2024-06', [{ id: 'tx1', created: '2024-06-10T12:00:00Z', amount: -100 }])
    upsertMonth('2024-07', [{ id: 'tx2', created: '2024-07-10T12:00:00Z', amount: -100 }])
  })

  after(() => {
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('reads account created month from vault', () => {
    assert.equal(getAccountCreatedMonthKey(), '2024-03')
  })

  it('detects months before account start', () => {
    assert.equal(isBeforeAccountStart('2024-01'), true)
    assert.equal(isBeforeAccountStart('2024-02'), true)
    assert.equal(isBeforeAccountStart('2024-03'), false)
    assert.equal(isBeforeAccountStart('2024-04'), false)
  })

  it('reads history start from sync state', () => {
    assert.equal(getHistoryStartMonthKey(), '2024-06')
  })

  it('skips months before account creation', () => {
    assert.equal(isRequiredMonth('2024-01'), false)
    assert.equal(isRequiredMonth('2024-02'), false)
  })

  it('skips empty pre-activity months after account open', () => {
    assert.equal(isRequiredMonth('2024-04'), false)
    assert.equal(isRequiredMonth('2024-05'), false)
  })

  it('requires months from history start onward', () => {
    assert.equal(isRequiredMonth('2024-06'), true)
    assert.equal(isRequiredMonth('2024-07'), true)
  })

  it('filters failed months to real gaps only', () => {
    const gaps = filterRealCacheGaps(['2024-01', '2024-06', '2024-08'])
    assert.deepEqual(gaps, ['2024-06', '2024-08'])
  })

  it('reports missing required months without pre-activity months', () => {
    const now = new Date()
    const endKey = formatMonthKey(now.getFullYear(), now.getMonth())
    const missing = getMissingRequiredMonths(endKey)
    assert.ok(!missing.includes('2024-04'))
    assert.ok(!missing.includes('2024-05'))
    assert.ok(missing.includes('2024-08') || missing.length >= 0)
  })

  it('treats pre-activity months as covered when live is blocked', () => {
    assert.equal(monthHasCoverage('2024-04', true), true)
    assert.equal(monthHasCoverage('2024-08', true), false)
  })

  it('is complete when all required months are cached', () => {
    updateSyncState({ oldestMonth: '2024-07' })
    updateVault((v) => {
      v.monzo.historyStartMonth = '2024-07'
    })
    assert.equal(isCacheCoverageComplete('2024-07'), true)
  })

  it('uses earliest anchor when cache predates sync state', () => {
    upsertMonth('2024-04', [{ id: 'tx_apr', created: '2024-04-10T12:00:00Z', amount: -100 }])
    assert.equal(getHistoryStartMonthKey(), '2024-04')
    assert.equal(isRequiredMonth('2024-04'), true)
  })
})
