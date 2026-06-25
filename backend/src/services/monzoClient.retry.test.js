import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monzo-dash-retry-'))
process.env.VAULT_PATH = path.join(testDir, 'vault.enc')

const { initVault, updateVault } = await import('./vault.js')
const { getBalance, getAccessToken, refreshAccessToken } = await import('./monzoClient.js')

const originalFetch = globalThis.fetch

function jsonResponse(body, { ok = true, status = ok ? 200 : 500 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  }
}

describe('monzoClient transient fetch retry', () => {
  before(() => {
    initVault('retry-test-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = 'access_test'
      v.monzo.expiresAt = Date.now() + 3_600_000
    })
  })

  after(() => {
    globalThis.fetch = originalFetch
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('retries once after a transient fetch failure', async () => {
    let attempts = 0
    globalThis.fetch = async (url) => {
      const target = String(url)
      if (target.includes('/balance')) {
        attempts += 1
        if (attempts === 1) {
          throw new TypeError('fetch failed')
        }
        return jsonResponse({ balance: 4200, spend_today: 0 })
      }
      throw new Error(`Unexpected fetch: ${target}`)
    }

    const data = await getBalance('acc_test')
    assert.equal(data.balance, 4200)
    assert.equal(attempts, 2)
  })

  it('does not retry HTTP error responses', async () => {
    let attempts = 0
    globalThis.fetch = async (url) => {
      const target = String(url)
      if (target.includes('/balance')) {
        attempts += 1
        return jsonResponse({ error: 'forbidden' }, { ok: false, status: 403 })
      }
      throw new Error(`Unexpected fetch: ${target}`)
    }

    await assert.rejects(() => getBalance('acc_test'), /forbidden/)
    assert.equal(attempts, 1)
  })
})

describe('monzoClient refresh token mutex', () => {
  before(() => {
    initVault('retry-test-passphrase')
    updateVault((v) => {
      v.monzo.accountId = 'acc_test'
      v.monzo.clientId = 'oauth2client_test'
      v.monzo.clientSecret = 'secret_test'
      v.monzo.refreshToken = 'refresh_test'
      v.monzo.accessToken = ''
      v.monzo.expiresAt = 0
    })
  })

  after(() => {
    globalThis.fetch = originalFetch
  })

  it('shares one in-flight token refresh across concurrent callers', async () => {
    let refreshCalls = 0
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url)
      if (target.includes('/oauth2/token')) {
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 25))
        return jsonResponse({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600
        })
      }
      if (target.includes('/balance') && options.method !== 'POST') {
        return jsonResponse({ balance: 9000, spend_today: 0 })
      }
      throw new Error(`Unexpected fetch: ${target}`)
    }

    const [tokenA, tokenB] = await Promise.all([
      getAccessToken(),
      refreshAccessToken()
    ])

    assert.equal(tokenA, 'new_access_token')
    assert.equal(tokenB, 'new_access_token')
    assert.equal(refreshCalls, 1)
  })
})
