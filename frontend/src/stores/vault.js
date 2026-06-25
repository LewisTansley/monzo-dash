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
    uiUnlocked: false,
    frontendInactivityTimeoutMinutes: null,
    hasMonzoCredentials: false,
    isMonzoConnected: false,
    hasMonzoTokens: false,
    accountId: '',
    loading: false,
    error: null
  }),
  getters: {
    isAccessible: (state) => state.unlocked && state.uiUnlocked
  },
  actions: {
    async refreshStatus() {
      const { data } = await vaultApi.status()
      const wasUnlocked = this.unlocked
      this.exists = data.exists
      this.unlocked = data.unlocked
      this.frontendInactivityTimeoutMinutes =
        data.frontendInactivityTimeoutMinutes ?? null
      this.hasMonzoCredentials = data.hasMonzoCredentials
      this.isMonzoConnected = data.isMonzoConnected
      this.hasMonzoTokens = data.hasMonzoTokens
      this.accountId = data.accountId || ''
      if (!this.unlocked) {
        this.uiUnlocked = false
      } else if (!wasUnlocked && this.unlocked) {
        // Backend became unlocked; UI session still requires passphrase.
      }
      return data
    },
    async init(passphrase, options = {}) {
      this.loading = true
      this.error = null
      try {
        await vaultApi.init(passphrase, options)
        await this.refreshStatus()
        this.uiUnlocked = true
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
        this.uiUnlocked = true
      } catch (e) {
        this.error = formatVaultError(e)
        throw e
      } finally {
        this.loading = false
      }
    },
    async unlockUi(passphrase) {
      this.loading = true
      this.error = null
      try {
        await vaultApi.verify(passphrase)
        this.uiUnlocked = true
      } catch (e) {
        this.error = formatVaultError(e)
        throw e
      } finally {
        this.loading = false
      }
    },
    lockUi() {
      this.uiUnlocked = false
    },
    async lock() {
      this.lockUi()
    }
  }
})
