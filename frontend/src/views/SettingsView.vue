<template>
  <div class="settings-view">
    <AppletShell variant="bare">
      <div class="applet-center applet-center--page">
        <div class="applet-center-inner">
          <SectionNavBar
            v-model="activeSection"
            :tabs="sectionTabs" />

          <p v-if="message" class="sw-message success">{{ message }}</p>
          <p v-if="error" class="sw-message error">{{ error }}</p>

          <section v-show="activeSection === 'vault'" class="sw-form-section">
            <h2 class="sw-section-title">Vault</h2>
            <template v-if="!vault.unlocked">
              <p v-if="!vault.exists" class="sw-secondary">
                Create an encrypted vault to store your Monzo credentials locally.
              </p>
              <p v-else class="sw-secondary">Unlock your vault to continue.</p>
              <form @submit.prevent="handleVault">
                <label>
                  Passphrase
                  <input v-model="passphrase" type="password" autocomplete="new-password" required minlength="8" />
                </label>
                <label class="checkbox">
                  <input v-model="allowHeadlessRuns" type="checkbox" />
                  Allow automatic runs without the dashboard open
                </label>
                <p class="sw-muted secret-hint">
                  Uses your passphrase for this server session. When enabled, it is stored
                  encrypted in <code>.vault/</code> so automations can run after a container restart.
                </p>
                <BaseButton type="submit" :disabled="vault.loading">
                  {{ vault.exists ? 'Unlock' : 'Create vault' }}
                </BaseButton>
              </form>
            </template>
            <template v-else-if="!vault.uiUnlocked">
              <p class="sw-secondary">Dashboard is locked. Use the unlock screen to continue.</p>
            </template>
            <template v-else>
              <p class="sw-secondary">Vault is unlocked.</p>
              <label class="checkbox">
                <input
                  v-model="allowHeadlessRuns"
                  type="checkbox"
                  :disabled="settingsSaving"
                  @change="saveSettings" />
                Allow automatic runs without the dashboard open
              </label>
              <p class="sw-muted secret-hint">
                Keeps your unlocked session available for the automation scheduler.
                <span v-if="headlessSessionStored">Encrypted session saved for container restarts.</span>
                <span v-else>Unlock again with this option enabled to persist across restarts.</span>
              </p>
              <label class="timeout-label">
                Auto-lock dashboard after inactivity
                <select
                  v-model="frontendInactivityTimeout"
                  :disabled="settingsSaving"
                  @change="saveSettings">
                  <option value="">Never</option>
                  <option value="1">1 minute</option>
                  <option value="3">3 minutes</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                </select>
              </label>
              <p class="sw-muted secret-hint">
                Locks the dashboard UI only. Background automations keep running when headless runs
                are enabled.
              </p>
              <div class="btn-row">
                <BaseButton variant="secondary" @click="lockDashboard">Lock dashboard</BaseButton>
              </div>
              <p class="sw-muted secret-hint">
                Locks the dashboard on this device. Automations are unaffected.
              </p>
            </template>
          </section>

          <template v-if="vault.isAccessible">
            <section v-show="activeSection === 'monzo'" class="sw-form-section">
              <h2 class="sw-section-title">Monzo API credentials</h2>
              <p class="sw-secondary">
                Register a <strong>Confidential</strong> OAuth client at
                <a href="https://developers.monzo.com" target="_blank" rel="noopener">developers.monzo.com</a>.
                Use the Client ID starting with <code>oauth2client_</code>.
              </p>
              <p class="sw-secondary">
                Redirect URI: <code>{{ redirectUri }}</code>
              </p>
              <p class="sw-secondary warn">Use <code>localhost</code>, not <code>127.0.0.1</code>.</p>
              <form @submit.prevent="saveCredentials">
                <label>
                  Client ID
                  <input v-model="clientId" type="text" required />
                </label>
                <label>
                  Client secret
                  <span v-if="!hasSecret" class="required-tag">required</span>
                  <input
                    v-model="clientSecret"
                    type="password"
                    autocomplete="off"
                    :required="!hasSecret"
                    :placeholder="hasSecret ? 'Enter new secret to replace saved value' : 'From developers.monzo.com'" />
                </label>
                <p v-if="hasSecret" class="sw-muted secret-hint">
                  A secret is saved. Leave blank to keep it.
                </p>
                <BaseButton type="submit">Save credentials</BaseButton>
              </form>

              <h2 class="sw-section-title" style="margin-top: 2rem">Monzo connection</h2>
              <p v-if="vault.isMonzoConnected" class="status connected">Connected to Monzo</p>
              <p v-else-if="vault.hasMonzoTokens" class="status pending">
                Authorized — approve in your Monzo app, then finish setup
              </p>
              <p v-else class="status sw-muted">Not connected</p>
              <ol v-if="vault.hasMonzoTokens && !vault.isMonzoConnected" class="steps">
                <li>Open the <strong>Monzo app</strong> on your phone</li>
                <li>Tap the alert to approve API access</li>
                <li>Click <strong>Finish connection</strong> below</li>
              </ol>
              <p v-if="finishingSetup" class="sw-secondary">{{ finishStatus }}</p>
              <p v-if="syncStatus.running" class="sw-secondary sync-banner">
                Syncing transaction history… {{ syncStatus.monthsSynced }} month(s) cached so far.
              </p>
              <p
                v-else-if="vault.isMonzoConnected && syncStatus.cachedMonthCount === 0 && syncStatus.status !== 'completed'"
                class="sw-secondary warn">
                No transaction history cached yet. Use <strong>Sync history</strong> below, or reconnect
                Monzo to backfill older transactions (available briefly after sign-in).
              </p>
              <p v-else-if="syncStatus.status === 'completed' && syncStatus.cachedMonthCount > 0" class="sw-secondary">
                Transaction history cached: {{ syncStatus.cachedMonthCount }} month(s)
                <span v-if="syncStatus.oldestCachedMonth"> back to {{ syncStatus.oldestCachedMonth }}</span>.
              </p>
              <p
                v-if="vault.isMonzoConnected && syncStatus.missingRequiredMonths?.length"
                class="sw-secondary warn">
                Missing cached months:
                {{ syncStatus.missingRequiredMonths.join(', ') }}.
                Sync history while Monzo app access is active to backfill.
              </p>
              <p
                v-if="vault.isMonzoConnected && syncStatus.stoppedReason === 'verification_required'"
                class="sw-secondary warn">
                Sync stopped — approve access in the Monzo app, then sync again.
              </p>
              <p v-if="diagnosisHint" class="sw-secondary warn">{{ diagnosisHint }}</p>
              <div class="btn-row">
                <BaseButton
                  v-if="vault.hasMonzoCredentials && !vault.hasMonzoTokens"
                  @click="connectMonzo">
                  Connect Monzo
                </BaseButton>
                <BaseButton
                  v-if="vault.hasMonzoTokens && !vault.isMonzoConnected"
                  :disabled="finishingSetup"
                  @click="finishConnection">
                  {{ finishingSetup ? 'Waiting for approval…' : 'Finish connection' }}
                </BaseButton>
                <BaseButton
                  v-if="vault.isMonzoConnected"
                  variant="secondary"
                  :disabled="syncStatus.running || syncStarting"
                  @click="startSyncHistory">
                  {{ syncStatus.running || syncStarting ? 'Syncing history…' : 'Sync history' }}
                </BaseButton>
              </div>
              <p v-if="vault.isMonzoConnected" class="sw-muted secret-hint">
                Fetches older transactions from Monzo into the local cache. Works best shortly after
                connecting or approving access in the Monzo app.
              </p>
            </section>
          </template>
        </div>
      </div>
    </AppletShell>
  </div>
</template>

<script>
import { AppletShell, BaseButton, SectionNavBar } from '../components/common'
import { useVaultStore } from '../stores/vault.js'
import { vaultApi, authApi, settingsApi, monzoApi } from '../services/api.js'
import { useDataStatusStore } from '../stores/dataStatus.js'

export default {
  name: 'SettingsView',
  components: { AppletShell, BaseButton, SectionNavBar },
  data() {
    return {
      activeSection: 'vault',
      passphrase: '',
      clientId: '',
      clientSecret: '',
      hasSecret: false,
      redirectUri: 'http://localhost:3001/api/auth/monzo/callback',
      message: '',
      error: '',
      finishingSetup: false,
      finishStatus: '',
      diagnosisHint: '',
      allowHeadlessRuns: false,
      frontendInactivityTimeout: '',
      headlessSessionStored: false,
      settingsSaving: false,
      syncStatus: {
        status: 'idle',
        running: false,
        monthsSynced: 0,
        cachedMonthCount: 0,
        oldestCachedMonth: null,
        missingRequiredMonths: [],
        stoppedReason: null
      },
      syncStarting: false,
      syncPollTimer: null
    }
  },
  computed: {
    vault() {
      return useVaultStore()
    },
    sectionTabs() {
      const tabs = [{ id: 'vault', label: 'Vault' }]
      if (this.vault.isAccessible) {
        tabs.push({ id: 'monzo', label: 'Monzo' })
      }
      return tabs
    },
    dataStatus() {
      return useDataStatusStore()
    }
  },
  async mounted() {
    try {
      await this.vault.refreshStatus()
    } catch (e) {
      this.error = e.response?.data?.error ||
        (e.code === 'ERR_NETWORK' ? 'Cannot reach the API. Start the backend with ./run-backend.sh or ./run-both.sh.' : e.message)
    }
    if (this.$route.query.connected) {
      await this.vault.refreshStatus()
      if (!this.vault.isMonzoConnected && this.vault.hasMonzoTokens) {
        await this.finishConnection()
      } else if (this.vault.isMonzoConnected) {
        this.message = 'Monzo connected successfully.'
        await this.loadSyncStatus()
        this.startSyncPolling()
      }
      this.$router.replace({ query: {} })
    }
    if (this.$route.query.error) {
      this.error = this.$route.query.error
    }
    if (this.vault.unlocked) {
      await this.loadSettings()
      if (this.vault.uiUnlocked) {
        await this.loadMonzoSetup()
        await this.loadCredentials()
        if (this.vault.hasMonzoTokens && !this.vault.isMonzoConnected) {
          await this.loadDiagnosis()
        }
        if (this.vault.isMonzoConnected) {
          await this.loadSyncStatus()
          this.startSyncPolling()
        }
      }
    }
  },
  beforeUnmount() {
    this.stopSyncPolling()
  },
  watch: {
    'dataStatus.refreshGeneration'() {
      if (this.dataStatus.refreshing) {
        this.handleAppRefresh()
      }
    },
    'vault.uiUnlocked'(unlocked) {
      if (!unlocked && this.activeSection === 'monzo') {
        this.activeSection = 'vault'
      }
    }
  },
  methods: {
    async handleVault() {
      this.error = ''
      this.message = ''
      try {
        const creating = !this.vault.exists
        const unlockOptions = { allowHeadlessRuns: this.allowHeadlessRuns }
        if (creating) {
          await this.vault.init(this.passphrase, unlockOptions)
        } else {
          await this.vault.unlock(this.passphrase, unlockOptions)
        }
        this.passphrase = ''
        this.message = creating ? 'Vault created.' : 'Vault unlocked.'
      } catch {
        this.error = this.vault.error || 'Vault operation failed'
        return
      }
      try {
        await this.loadSettings()
        await this.loadMonzoSetup()
        await this.loadCredentials()
      } catch {
        // optional sections
      }
      const redirect = this.$route.query.redirect
      if (redirect) this.$router.push(redirect)
    },
    async loadSettings() {
      try {
        const { data } = await settingsApi.get()
        this.allowHeadlessRuns = Boolean(
          data.settings?.allowHeadlessRuns ?? data.settings?.autoUnlockOnStartup
        )
        this.headlessSessionStored = Boolean(data.headlessSessionStored)
        const timeout = data.settings?.frontendInactivityTimeoutMinutes
        this.frontendInactivityTimeout =
          timeout === null || timeout === undefined ? '' : String(timeout)
        this.vault.frontendInactivityTimeoutMinutes =
          timeout === null || timeout === undefined ? null : Number(timeout)
      } catch {
        // optional
      }
    },
    async saveSettings() {
      this.settingsSaving = true
      this.error = ''
      try {
        const payload = {
          allowHeadlessRuns: this.allowHeadlessRuns,
          frontendInactivityTimeoutMinutes: this.frontendInactivityTimeout
            ? Number(this.frontendInactivityTimeout)
            : null
        }
        const { data } = await settingsApi.update(payload)
        this.allowHeadlessRuns = Boolean(data.settings?.allowHeadlessRuns)
        this.headlessSessionStored = Boolean(data.headlessSessionStored)
        const timeout = data.settings?.frontendInactivityTimeoutMinutes
        this.frontendInactivityTimeout =
          timeout === null || timeout === undefined ? '' : String(timeout)
        this.vault.frontendInactivityTimeoutMinutes =
          timeout === null || timeout === undefined ? null : Number(timeout)
        this.message = 'Settings saved.'
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.settingsSaving = false
      }
    },
    async loadMonzoSetup() {
      try {
        const { data } = await vaultApi.getMonzoSetup()
        if (data.redirectUri) this.redirectUri = data.redirectUri
      } catch {
        // use default
      }
    },
    async loadCredentials() {
      const { data } = await vaultApi.getMonzoCredentials()
      this.clientId = data.clientId || ''
      this.hasSecret = data.hasClientSecret
    },
    async saveCredentials() {
      this.error = ''
      this.message = ''
      const clientId = this.clientId.trim()
      const secret = this.clientSecret.trim()

      if (!clientId) {
        this.error = 'Client ID is required'
        return
      }
      if (!this.hasSecret && !secret) {
        this.error = 'Client secret is required'
        return
      }

      try {
        const payload = { clientId }
        if (secret) payload.clientSecret = secret
        const { data } = await vaultApi.setMonzoCredentials(payload)
        this.hasSecret = data.hasClientSecret
        this.message = secret ? 'Client ID and secret saved.' : 'Client ID saved (secret unchanged).'
        this.clientSecret = ''
        await this.vault.refreshStatus()
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      }
    },
    async connectMonzo() {
      this.error = ''
      try {
        const { data } = await authApi.monzoUrl()
        window.location.href = data.url
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      }
    },
    async loadDiagnosis() {
      try {
        const { data } = await authApi.diagnose()
        this.diagnosisHint = data.diagnosis?.lastError || ''
      } catch {
        this.diagnosisHint = ''
      }
    },
    async loadSyncStatus() {
      if (!this.vault.isMonzoConnected) return
      try {
        const { data } = await monzoApi.transactionSyncStatus()
        this.syncStatus = {
          status: data.status || 'idle',
          running: Boolean(data.running),
          monthsSynced: data.monthsSynced || 0,
          cachedMonthCount: data.cachedMonthCount || 0,
          oldestCachedMonth: data.oldestCachedMonth || null,
          missingRequiredMonths: data.missingRequiredMonths || [],
          stoppedReason: data.stoppedReason || null
        }
        this.dataStatus.report({ syncInProgress: Boolean(data.running) })
      } catch {
        // optional
      }
    },
    startSyncPolling() {
      this.stopSyncPolling()
      if (!this.vault.isMonzoConnected) return
      this.syncPollTimer = setInterval(async () => {
        await this.loadSyncStatus()
        if (!this.syncStatus.running) {
          this.stopSyncPolling()
        }
      }, 3000)
    },
    stopSyncPolling() {
      if (this.syncPollTimer) {
        clearInterval(this.syncPollTimer)
        this.syncPollTimer = null
      }
    },
    async startSyncHistory() {
      this.error = ''
      this.message = ''
      this.syncStarting = true
      try {
        const { data } = await monzoApi.startTransactionSync()
        if (data.started) {
          this.message =
            data.message ||
            'Historical sync started. Open the Monzo app if prompted to approve access.'
          await this.loadSyncStatus()
          this.startSyncPolling()
        } else if (data.reason === 'already_running') {
          this.message = 'Historical sync is already running.'
          await this.loadSyncStatus()
          this.startSyncPolling()
        } else {
          this.error = data.reason === 'not_connected'
            ? 'Connect Monzo before syncing history.'
            : 'Could not start historical sync.'
        }
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.syncStarting = false
      }
    },
    async handleAppRefresh() {
      try {
        await this.vault.refreshStatus()
        if (this.vault.isMonzoConnected) {
          await this.loadSyncStatus()
        }
      } finally {
        this.dataStatus.finishRefresh()
      }
    },
    async finishConnection() {
      this.error = ''
      this.message = ''
      this.finishingSetup = true
      this.finishStatus = 'Checking Monzo approval…'

      const maxTries = 36
      for (let i = 0; i < maxTries; i++) {
        this.finishStatus = `Waiting for Monzo app approval… (${i + 1}/${maxTries})`
        try {
          const { data } = await authApi.completeSetup()
          await this.vault.refreshStatus()
          if (data.isMonzoConnected || this.vault.isMonzoConnected) {
            this.message = 'Monzo connected successfully.'
            this.diagnosisHint = ''
            this.finishingSetup = false
            await this.loadSyncStatus()
            this.startSyncPolling()
            return
          }
        } catch (e) {
          const msg = e.response?.data?.error || e.message
          this.diagnosisHint = e.response?.data?.diagnosis?.lastError || msg
          if (!/approve|waiting|not yet|forbidden|accounts/i.test(msg)) {
            this.error = msg
            await this.vault.refreshStatus()
            this.finishingSetup = false
            return
          }
        }
        await new Promise((r) => setTimeout(r, 5000))
      }

      this.error = 'Timed out waiting for approval. Open the Monzo app, tap Approve, then try again.'
      await this.loadDiagnosis()
      this.finishingSetup = false
    },
    lockDashboard() {
      this.vault.lockUi()
      this.activeSection = 'vault'
      this.message = 'Dashboard locked.'
    }
  }
}
</script>

<style scoped>
.settings-view {
  height: 100%;
  min-height: 0;
}

.settings-view label.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.settings-view label.timeout-label {
  display: block;
  margin-top: 1rem;
}

.settings-view label.timeout-label select {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
}

.warn {
  color: var(--sw-warning);
}

.required-tag {
  margin-left: 0.35rem;
  font-size: 0.75rem;
  color: var(--sw-warning);
  text-transform: uppercase;
}

.secret-hint {
  margin-top: -0.5rem;
  font-size: 0.85rem;
}

.steps {
  margin: 0 0 1rem 1.1rem;
  padding: 0;
  color: var(--sw-text-secondary);
  font-size: 0.9rem;
  line-height: 1.7;
}

.status.connected {
  color: var(--sw-success);
}

.status.pending {
  color: var(--sw-warning);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

code {
  font-size: 0.85rem;
  word-break: break-all;
}
</style>
