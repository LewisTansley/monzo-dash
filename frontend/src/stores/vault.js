import { defineStore } from 'pinia'
import { vaultApi } from '../services/api.js'

function formatVaultError(e) {
  if (e.response?.data?.error) return e.response.data.error
  if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
    return 'Cannot reach the API. Start the backend with ./run-backend.sh or ./run-both.sh.'
  }
  return e.message || 'Vault operation failed'
}

export const useVaultStore = defineStore('vault', {
  state: () => ({
    exists: false,
    unlocked: false,
    hasMonzoCredentials: false,
    isMonzoConnected: false,
    hasMonzoTokens: false,
    accountId: '',
    loading: false,
    error: null
  }),
  actions: {
    async refreshStatus() {
      const { data } = await vaultApi.status()
      this.exists = data.exists
      this.unlocked = data.unlocked
      this.hasMonzoCredentials = data.hasMonzoCredentials
      this.isMonzoConnected = data.isMonzoConnected
      this.hasMonzoTokens = data.hasMonzoTokens
      this.accountId = data.accountId || ''
      return data
    },
    async init(passphrase, options = {}) {
      this.loading = true
      this.error = null
      try {
        await vaultApi.init(passphrase, options)
        await this.refreshStatus()
      } catch (e) {
        this.error = formatVaultError(e)
        throw e
      } finally {
        this.loading = false
      }
    },
    async unlock(passphrase, options = {}) {
      this.loading = true
      this.error = null
      try {
        await vaultApi.unlock(passphrase, options)
        await this.refreshStatus()
      } catch (e) {
        this.error = formatVaultError(e)
        throw e
      } finally {
        this.loading = false
      }
    },
    async lock() {
      await vaultApi.lock()
      await this.refreshStatus()
    }
  }
})
