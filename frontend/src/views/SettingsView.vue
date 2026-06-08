<template>
  <div class="settings-view">
    <AppletShell
      v-model:left-visible="leftVisible"
      :has-right-column="false">
      <template #left>
        <SidebarPanel
          embedded
          title="Settings"
          :tabs="sectionTabs"
          :default-tab="activeSection"
          @tab-change="activeSection = $event">
          <template #vault>
            <div data-sidebar-stagger-root>
              <p class="sw-muted section-hint">Encrypted local storage for credentials.</p>
            </div>
          </template>
          <template #monzo>
            <div data-sidebar-stagger-root>
              <p class="sw-muted section-hint">OAuth client and Monzo connection.</p>
            </div>
          </template>
          <template #budgets>
            <div data-sidebar-stagger-root>
              <p class="sw-muted section-hint">Monthly category limits for projections.</p>
            </div>
          </template>
        </SidebarPanel>
      </template>

      <div class="applet-center">
        <div class="applet-center-inner">
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
                <BaseButton type="submit" :disabled="vault.loading">
                  {{ vault.exists ? 'Unlock' : 'Create vault' }}
                </BaseButton>
              </form>
            </template>
            <p v-else class="sw-secondary">Vault is unlocked.</p>
          </section>

          <template v-if="vault.unlocked">
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
                <BaseButton variant="secondary" @click="lockVault">Lock vault</BaseButton>
              </div>
            </section>

            <section v-show="activeSection === 'budgets'" class="sw-form-section">
              <h2 class="sw-section-title">Category budgets (monthly)</h2>
              <p class="sw-secondary">Amounts in pounds. Used for budget projections on the dashboard.</p>
              <div v-for="cat in budgetCategories" :key="cat" class="budget-row">
                <label>{{ cat.replace(/_/g, ' ') }}</label>
                <input
                  v-model="budgetInputs[cat]"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00" />
              </div>
              <BaseButton @click="saveBudgets">Save budgets</BaseButton>
            </section>
          </template>
        </div>
      </div>
    </AppletShell>
  </div>
</template>

<script>
import { AppletShell, SidebarPanel, BaseButton } from '../components/common'
import { useVaultStore } from '../stores/vault.js'
import { vaultApi, authApi, budgetsApi } from '../services/api.js'
import { parsePoundsToMinor } from '../utils/money.js'

const BUDGET_CATEGORIES = [
  'groceries', 'eating_out', 'transport', 'bills', 'entertainment',
  'shopping', 'holidays', 'general', 'expenses', 'cash'
]

export default {
  name: 'SettingsView',
  components: { AppletShell, SidebarPanel, BaseButton },
  data() {
    return {
      leftVisible: true,
      activeSection: 'vault',
      sectionTabs: [
        { id: 'vault', text: 'VAULT', title: 'Vault' },
        { id: 'monzo', text: 'MONZO', title: 'Monzo' },
        { id: 'budgets', text: 'BUDGETS', title: 'Budgets' }
      ],
      passphrase: '',
      clientId: '',
      clientSecret: '',
      hasSecret: false,
      redirectUri: 'http://localhost:3001/api/auth/monzo/callback',
      message: '',
      error: '',
      budgetCategories: BUDGET_CATEGORIES,
      budgetInputs: {},
      finishingSetup: false,
      finishStatus: '',
      diagnosisHint: ''
    }
  },
  computed: {
    vault() {
      return useVaultStore()
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
      }
      this.$router.replace({ query: {} })
    }
    if (this.$route.query.error) {
      this.error = this.$route.query.error
    }
    if (this.vault.unlocked) {
      await this.loadMonzoSetup()
      await this.loadCredentials()
      await this.loadBudgets()
      if (this.vault.hasMonzoTokens && !this.vault.isMonzoConnected) {
        await this.loadDiagnosis()
      }
    }
  },
  methods: {
    async handleVault() {
      this.error = ''
      this.message = ''
      try {
        const creating = !this.vault.exists
        if (creating) {
          await this.vault.init(this.passphrase)
        } else {
          await this.vault.unlock(this.passphrase)
        }
        this.passphrase = ''
        this.message = creating ? 'Vault created.' : 'Vault unlocked.'
      } catch {
        this.error = this.vault.error || 'Vault operation failed'
        return
      }
      try {
        await this.loadMonzoSetup()
        await this.loadCredentials()
        await this.loadBudgets()
      } catch {
        // optional sections
      }
      const redirect = this.$route.query.redirect
      if (redirect) this.$router.push(redirect)
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
    async lockVault() {
      await this.vault.lock()
      this.activeSection = 'vault'
    },
    async loadBudgets() {
      const { data } = await budgetsApi.get()
      const inputs = {}
      for (const cat of BUDGET_CATEGORIES) {
        const minor = data.budgets?.[cat]
        inputs[cat] = minor ? (minor / 100).toFixed(2) : ''
      }
      this.budgetInputs = inputs
    },
    async saveBudgets() {
      const budgets = {}
      for (const cat of BUDGET_CATEGORIES) {
        const val = this.budgetInputs[cat]
        if (val !== '' && val != null) {
          budgets[cat] = parsePoundsToMinor(val)
        }
      }
      await budgetsApi.set(budgets)
      this.message = 'Budgets saved.'
    }
  }
}
</script>

<style scoped>
.settings-view {
  height: 100%;
  min-height: 0;
}

.section-hint {
  font-size: 0.85rem;
  margin: 0;
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

.budget-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.budget-row label {
  text-transform: capitalize;
  font-size: 0.9rem;
  color: var(--sw-text-secondary);
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
