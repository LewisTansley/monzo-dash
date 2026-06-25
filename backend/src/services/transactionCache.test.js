import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-cache-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, lockVault, unlockVault, updateVault } = await import('./vault.js')
const {
  upsertMonth,
  getMonth,
  hasMonth,
  getSyncState,
  updateSyncState
} = await import('./transactionCache.js')

const PASSPHRASE = 'test-passphrase-123'

function makeTx(id) {
  return {
    id,
    created: '2024-06-15T12:00:00Z',
    amount: -500,
    category: 'general',
    description: `Test ${id}`
  }
}

describe('transactionCache', () => {
  before(() => {
    initVault(PASSPHRASE)
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
    })
  })

  after(() => {
    lockVault()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('encrypts month files on disk', () => {
    upsertMonth('2024-06', [makeTx('tx_a')])
    const raw = fs.readFileSync(
      path.join(testDir, 'transactions', '2024-06.enc'),
      'utf8'
    )
    assert.doesNotMatch(raw, /tx_a/)
    assert.match(raw, /"ciphertext"/)
  })

  it('deduplicates transactions by id on upsert', () => {
    upsertMonth('2024-05', [makeTx('tx_1'), makeTx('tx_2')])
    upsertMonth('2024-05', [makeTx('tx_1'), makeTx('tx_3')])
    const month = getMonth('2024-05')
    assert.equal(month.transactions.length, 3)
    assert.ok(hasMonth('2024-05'))
  })

  it('throws when vault is locked', () => {
    lockVault()
    assert.throws(() => getMonth('2024-06'), /Vault is locked/)
    unlockVault(PASSPHRASE)
  })

  it('persists sync state encrypted', () => {
    updateSyncState({ status: 'running', monthsSynced: 2 })
    const state = getSyncState()
    assert.equal(state.status, 'running')
    assert.equal(state.monthsSynced, 2)
  })
})
