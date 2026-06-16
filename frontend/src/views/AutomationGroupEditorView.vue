<template>
  <div class="editor-view">
    <AppletShell variant="bare">
      <div class="applet-center applet-center--page">
        <div class="applet-center-inner">
    <header class="page-header">
      <h1>{{ isNew ? 'New automation group' : 'Edit automation group' }}</h1>
      <router-link to="/automations">Back to list</router-link>
    </header>

    <form class="editor-form panel" @submit.prevent="save">
      <section>
        <label>
          Name
          <input v-model="form.name" required />
        </label>
        <label class="checkbox">
          <input v-model="form.enabled" type="checkbox" />
          Enabled
        </label>
        <label class="checkbox">
          <input v-model="form.showOnDashboard" type="checkbox" />
          Show on dashboard
        </label>
      </section>

      <section>
        <h2>Member automations</h2>
        <p v-if="!automations.length" class="muted">
          Create at least one automation before building a group.
        </p>
        <template v-else>
          <div class="member-pick">
            <label
              v-for="auto in automations"
              :key="auto.id"
              class="checkbox member-option">
              <input
                type="checkbox"
                :checked="form.automationIds.includes(auto.id)"
                @change="toggleMember(auto.id)" />
              <span class="member-label">
                <span class="member-name">
                  {{ auto.name }}
                  <span v-if="!auto.enabled" class="warn">(disabled)</span>
                </span>
                <span class="member-description">{{ automationDescription(auto) }}</span>
              </span>
            </label>
          </div>

          <div v-if="form.automationIds.length" class="order-section">
            <h3>Execution order</h3>
            <p class="muted small">Automations run top to bottom when the group button is pressed.</p>
            <div
              v-for="(id, idx) in form.automationIds"
              :key="id"
              class="order-row">
              <span class="order-num">{{ idx + 1 }}.</span>
              <div class="order-name">
                <span class="order-title">{{ automationName(id) }}</span>
                <span class="order-description">{{ automationDescriptionById(id) }}</span>
              </div>
              <div class="order-actions">
                <button
                  type="button"
                  class="icon-btn"
                  :disabled="idx === 0"
                  @click="moveUp(idx)">
                  Up
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :disabled="idx === form.automationIds.length - 1"
                  @click="moveDown(idx)">
                  Down
                </button>
              </div>
            </div>
          </div>
          <p v-if="hasDisabledMembers" class="warn">
            Some selected automations are disabled and will be skipped when the group runs.
          </p>
        </template>
      </section>

      <div class="form-actions">
        <BaseButton variant="secondary" text="Dry run" :disabled="!form.automationIds.length" @click="dryRun" />
        <BaseButton native-type="submit" text="Save" :disabled="!form.automationIds.length" />
      </div>

      <p v-if="dryRunResult" class="dry-result">{{ dryRunMessage }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
        </div>
      </div>
    </AppletShell>
  </div>
</template>

<script>
import { AppletShell, BaseButton } from '../components/common'
import { automationsApi, automationGroupsApi, monzoApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import { describeAutomationOneLine } from '../utils/automationDisplay.js'

function defaultForm() {
  return {
    name: '',
    enabled: true,
    showOnDashboard: true,
    automationIds: []
  }
}

export default {
  name: 'AutomationGroupEditorView',
  components: { AppletShell, BaseButton },
  data() {
    return {
      form: defaultForm(),
      automations: [],
      pots: [],
      dryRunResult: null,
      error: ''
    }
  },
  computed: {
    isNew() {
      return this.$route.name === 'AutomationGroupNew'
    },
    hasDisabledMembers() {
      return this.form.automationIds.some((id) => {
        const auto = this.automations.find((a) => a.id === id)
        return auto && !auto.enabled
      })
    },
    dryRunMessage() {
      if (!this.dryRunResult) return ''
      const steps = this.dryRunResult.steps || []
      const lines = steps.map((s) => {
        if (!s.conditionsMet || s.transferAmount <= 0) {
          return `${s.name}: skip`
        }
        return `${s.name}: ${formatMoney(s.transferAmount)}`
      })
      return [
        `Total: ${formatMoney(this.dryRunResult.totalTransferAmount || 0)}`,
        ...lines
      ].join(' · ')
    }
  },
  async mounted() {
    const [autosRes, potsRes] = await Promise.all([
      automationsApi.list(),
      monzoApi.pots()
    ])
    this.automations = autosRes.data.automations || []
    this.pots = potsRes.data.pots || []

    if (!this.isNew) {
      await this.loadGroup()
    }
  },
  methods: {
    displayContext() {
      return { pots: this.pots, accountLabel: 'Main account' }
    },
    automationDescription(auto) {
      return describeAutomationOneLine(auto, this.displayContext())
    },
    automationDescriptionById(id) {
      const auto = this.automations.find((a) => a.id === id)
      return auto ? this.automationDescription(auto) : ''
    },
    automationName(id) {
      return this.automations.find((a) => a.id === id)?.name || 'Unknown'
    },
    toggleMember(id) {
      const idx = this.form.automationIds.indexOf(id)
      if (idx === -1) {
        this.form.automationIds.push(id)
      } else {
        this.form.automationIds.splice(idx, 1)
      }
    },
    moveUp(idx) {
      if (idx === 0) return
      const ids = [...this.form.automationIds]
      ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
      this.form.automationIds = ids
    },
    moveDown(idx) {
      if (idx >= this.form.automationIds.length - 1) return
      const ids = [...this.form.automationIds]
      ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
      this.form.automationIds = ids
    },
    buildPayload() {
      return {
        name: this.form.name,
        enabled: this.form.enabled,
        showOnDashboard: this.form.showOnDashboard,
        automationIds: [...this.form.automationIds]
      }
    },
    async loadGroup() {
      const { data } = await automationGroupsApi.get(this.$route.params.id)
      const g = data.group
      this.form = {
        name: g.name,
        enabled: g.enabled,
        showOnDashboard: g.showOnDashboard,
        automationIds: [...(g.automationIds || [])]
      }
    },
    async save() {
      this.error = ''
      if (!this.form.automationIds.length) {
        this.error = 'Select at least one automation'
        return
      }
      try {
        const payload = this.buildPayload()
        if (this.isNew) {
          await automationGroupsApi.create(payload)
        } else {
          await automationGroupsApi.update(this.$route.params.id, payload)
        }
        this.$router.push('/automations')
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      }
    },
    async dryRun() {
      this.error = ''
      if (!this.form.automationIds.length) return
      try {
        let id = this.$route.params.id
        if (this.isNew) {
          const { data } = await automationGroupsApi.create(this.buildPayload())
          id = data.group.id
          this.$router.replace({ name: 'AutomationGroupEditor', params: { id } })
        } else {
          await automationGroupsApi.update(id, this.buildPayload())
        }
        const { data } = await automationGroupsApi.dryRun(id)
        this.dryRunResult = data
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      }
    }
  }
}
</script>

<style scoped>
.editor-view {
  height: 100%;
  min-height: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.panel {
  background: var(--sw-panel);
  border-radius: 8px;
  padding: 1.25rem;
}

section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--sw-border);
}

section h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

section h3 {
  margin: 1rem 0 0.5rem;
  font-size: 0.9rem;
}

label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--sw-text-secondary);
}

label.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

input[type='text'],
input:not([type='checkbox']) {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  border-radius: 6px;
  color: var(--sw-text-primary);
}

.member-pick {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.member-option {
  margin-bottom: 0;
  align-items: flex-start;
}

.member-label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.member-name {
  font-size: 0.9rem;
}

.member-description {
  font-size: 0.8rem;
  color: var(--sw-text-muted);
  line-height: 1.35;
}

.order-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--sw-border);
}

.order-num {
  color: var(--sw-text-muted);
  font-size: 0.85rem;
  min-width: 1.5rem;
}

.order-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.order-title {
  font-size: 0.9rem;
}

.order-description {
  font-size: 0.8rem;
  color: var(--sw-text-muted);
  line-height: 1.35;
}

.order-actions {
  display: flex;
  gap: 0.35rem;
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--sw-border);
  color: var(--sw-text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
}

.dry-result {
  color: var(--sw-blue-bright);
  margin-top: 1rem;
  font-size: 0.85rem;
}

.error {
  color: var(--sw-danger-soft);
}

.warn {
  color: var(--sw-warning);
  font-size: 0.85rem;
}

.muted {
  color: var(--sw-text-muted);
}

.small {
  font-size: 0.8rem;
}
</style>
