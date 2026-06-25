import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encryptJson, decryptJson } from './vaultCrypto.js'

describe('vaultCrypto', () => {
  it('round-trips JSON payloads', () => {
    const payload = { month: '2024-06', transactions: [{ id: 'tx_1', amount: -100 }] }
    const envelope = encryptJson(payload, 'test-passphrase')
    const restored = decryptJson(envelope, 'test-passphrase')
    assert.deepEqual(restored, payload)
  })

  it('rejects wrong passphrase', () => {
    const envelope = encryptJson({ ok: true }, 'correct')
    assert.throws(() => decryptJson(envelope, 'wrong'))
  })
})
