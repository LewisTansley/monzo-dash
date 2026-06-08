<template>
  <div class="automations-view">
    <AppletShell
      v-model:left-visible="leftVisible"
      v-model:right-visible="rightVisible">
      <template #left>
        <SidebarPanel
          embedded
          title="Automations"
          :tabs="leftTabs"
          default-tab="rules"
          @tab-change="leftTab = $event">
          <template #rules>
            <div data-sidebar-stagger-root>
              <p v-if="loading" class="sw-empty">Loading...</p>
              <p v-else-if="error && !editMode" class="sw-message error">{{ error }}</p>
              <p v-else-if="!automations.length" class="sw-empty">No automations yet</p>
              <div
                v-for="auto in automations"
                :key="auto.id"
                class="sw-list-row sw-list-row-stacked"
                :class="{ active: selectedKind === 'automation' && selectedId === auto.id }"
                @click="selectItem('automation', auto.id)">
                <div class="sw-list-row-main">
                  <span>{{ auto.name }}</span>
                  <span class="sw-badge" :class="{ on: auto.enabled }">
                    {{ auto.enabled ? 'On' : 'Off' }}
                  </span>
                </div>
                <span
                  v-if="automationRunSummary(auto)"
                  class="sw-run-hint"
                  :class="runStatusClass(automationRunSummary(auto).status)">
                  {{ automationRunSummary(auto).time }} · {{ automationRunSummary(auto).short }}
                </span>
                <span v-else class="sw-run-hint">Never run</span>
              </div>
            </div>
          </template>
          <template #groups>
            <div data-sidebar-stagger-root>
              <p v-if="!loading && !groups.length" class="sw-empty">No groups yet</p>
              <div
                v-for="group in groups"
                :key="group.id"
                class="sw-list-row sw-list-row-stacked"
                :class="{ active: selectedKind === 'group' && selectedId === group.id }"
                @click="selectItem('group', group.id)">
                <div class="sw-list-row-main">
                  <span>{{ group.name }}</span>
                  <span class="sw-list-meta">{{ (group.automationIds || []).length }} steps</span>
                </div>
                <span
                  v-if="groupRunSummary(group)"
                  class="sw-run-hint"
                  :class="runStatusClass(groupRunSummary(group).status)">
                  {{ groupRunSummary(group).time }} · {{ groupRunSummary(group).short }}
                </span>
                <span v-else class="sw-run-hint">Never run</span>
              </div>
            </div>
          </template>
        </SidebarPanel>
      </template>

      <div class="applet-center">
        <div class="applet-center-inner">
          <p v-if="error && !loading && !editMode" class="sw-message error">{{ error }}</p>
          <p
            v-if="runFeedback && !editMode"
            class="sw-message"
            :class="runFeedbackClass">
            {{ runFeedback }}
          </p>

          <template v-if="editMode && editForm">
            <h2 class="detail-name">{{ isNewEdit ? 'New automation' : 'Edit automation' }}</h2>
            <p class="sw-secondary edit-hint">Configure each section below.</p>

            <div class="section-cards">
              <div
                class="sw-list-row sw-list-row-stacked section-card"
                @click="activeEditModal = 'basics'">
                <div class="sw-list-row-main">
                  <span class="sw-label">Basics</span>
                  <span class="section-chevron">›</span>
                </div>
                <span class="sw-secondary">{{ basicsSummary }}</span>
              </div>
              <div
                class="sw-list-row sw-list-row-stacked section-card"
                @click="activeEditModal = 'conditions'">
                <div class="sw-list-row-main">
                  <span class="sw-label">Conditions</span>
                  <span class="section-chevron">›</span>
                </div>
                <span class="sw-secondary">{{ conditionsSummary }}</span>
              </div>
              <div
                class="sw-list-row sw-list-row-stacked section-card"
                @click="activeEditModal = 'action'">
                <div class="sw-list-row-main">
                  <span class="sw-label">Action</span>
                  <span class="section-chevron">›</span>
                </div>
                <span class="sw-secondary">{{ actionSummary }}</span>
              </div>
            </div>

            <div class="center-actions">
              <BaseButton variant="secondary" text="Cancel" @click="cancelEdit" />
              <BaseButton variant="secondary" text="Dry run" @click="dryRunEdit" />
              <BaseButton text="Save" @click="saveEdit" />
            </div>

            <p v-if="editDryRunResult" class="dry-result">{{ editDryRunMessage }}</p>
            <p v-if="editError" class="sw-message error">{{ editError }}</p>

            <AutomationSectionModals
              :form="editForm"
              :pots="pots"
              :account-id="accountId"
              :active-modal="activeEditModal"
              @update:active-modal="activeEditModal = $event" />
          </template>

          <template v-else-if="selectedItem">
            <h2 class="detail-name">{{ selectedItem.name }}</h2>
            <p class="sw-secondary cond-summary">{{ selectedSummary }}</p>
            <span class="sw-badge" :class="{ on: selectedItem.enabled }">
              {{ selectedItem.enabled ? 'Enabled' : 'Disabled' }}
            </span>
            <p v-if="isRunningSelected" class="running-note">Running…</p>
            <div v-if="selectedLastRun" class="run-history">
              <div class="run-history-header">
                <span class="sw-label">Last run</span>
                <span class="sw-badge" :class="runStatusClass(selectedLastRun.status)">
                  {{ runStatusLabel(selectedLastRun.status) }}
                </span>
              </div>
              <p class="run-history-time">{{ selectedLastRun.time }}</p>
              <p class="run-history-label">{{ selectedLastRun.label }}</p>
              <ul v-if="selectedLastRun.steps?.length" class="run-history-steps">
                <li v-for="(step, i) in selectedLastRun.steps" :key="i">{{ step }}</li>
              </ul>
            </div>
            <p v-else class="sw-muted never-run">Not run yet</p>
            <p v-if="selectedDryRun" class="dry-result">Preview: {{ selectedDryRun }}</p>
          </template>

          <template v-else-if="!loading">
            <p class="sw-empty">
              Select a rule or group from the left panel, or create a new automation.
            </p>
            <div class="center-actions">
              <BaseButton text="New automation" @click="createNew" />
              <BaseButton variant="secondary" text="New group" @click="createGroup" />
            </div>
          </template>
        </div>
      </div>

      <template #right>
        <SidebarPanel
          embedded
          title="Actions"
          :is-right="true"
          :tabs="[]"
          default-tab="">
          <div data-sidebar-stagger-root>
            <template v-if="editMode">
              <BaseButton variant="secondary" text="Cancel" @click="cancelEdit" />
              <BaseButton variant="secondary" text="Dry run" @click="dryRunEdit" />
              <BaseButton text="Save" @click="saveEdit" />
            </template>
            <template v-else-if="selectedKind === 'automation' && selectedAutomation">
              <BaseButton
                :text="isRunningSelected ? 'Running…' : 'Run'"
                :disabled="!!runningId"
                @click="run(selectedAutomation.id)" />
              <BaseButton
                variant="secondary"
                text="Dry run"
                :disabled="!!runningId"
                @click="dryRun(selectedAutomation.id)" />
              <BaseButton variant="secondary" text="Edit" @click="edit(selectedAutomation.id)" />
              <BaseButton variant="danger" text="Delete" @click="remove(selectedAutomation.id)" />
            </template>
            <template v-else-if="selectedKind === 'group' && selectedGroup">
              <BaseButton
                :text="isRunningSelected ? 'Running…' : 'Run'"
                :disabled="!!runningId"
                @click="runGroup(selectedGroup.id)" />
              <BaseButton
                variant="secondary"
                text="Dry run"
                :disabled="!!runningId"
                @click="dryRunGroup(selectedGroup.id)" />
              <BaseButton variant="secondary" text="Edit" @click="editGroup(selectedGroup.id)" />
              <BaseButton variant="danger" text="Delete" @click="removeGroup(selectedGroup.id)" />
            </template>
            <template v-else>
              <BaseButton text="New automation" @click="createNew" />
              <BaseButton variant="secondary" text="New group" @click="createGroup" />
            </template>
          </div>
        </SidebarPanel>
      </template>
    </AppletShell>
  </div>
</template>

<script>
import { AppletShell, SidebarPanel, BaseButton } from '../components/common'
import AutomationSectionModals from '../components/automations/AutomationSectionModals.vue'
import { automationsApi, automationGroupsApi, monzoApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import {
  summarizeAutomationRun,
  summarizeGroupRun,
  runStatusLabel
} from '../utils/automationRuns.js'
import {
  defaultForm,
  automationToForm,
  formToPayload
} from '../utils/automationForm.js'
import { useVaultStore } from '../stores/vault.js'

export default {
  name: 'AutomationsView',
  components: { AppletShell, SidebarPanel, BaseButton, AutomationSectionModals },
  data() {
    return {
      leftVisible: true,
      rightVisible: true,
      leftTab: 'rules',
      leftTabs: [
        { id: 'rules', text: 'RULES', title: 'Rules' },
        { id: 'groups', text: 'GROUPS', title: 'Groups' }
      ],
      automations: [],
      groups: [],
      loading: false,
      error: '',
      selectedKind: null,
      selectedId: null,
      dryRunResults: {},
      groupDryRunResults: {},
      runningId: null,
      runFeedback: '',
      runFeedbackStatus: '',
      editMode: false,
      editForm: null,
      editAutomationId: null,
      activeEditModal: null,
      pots: [],
      accountId: '',
      editError: '',
      editDryRunResult: null
    }
  },
  computed: {
    selectedAutomation() {
      if (this.selectedKind !== 'automation') return null
      return this.automations.find((a) => a.id === this.selectedId) || null
    },
    selectedGroup() {
      if (this.selectedKind !== 'group') return null
      return this.groups.find((g) => g.id === this.selectedId) || null
    },
    selectedItem() {
      return this.selectedAutomation || this.selectedGroup
    },
    selectedSummary() {
      if (this.selectedAutomation) return this.summarize(this.selectedAutomation)
      if (this.selectedGroup) return this.summarizeGroup(this.selectedGroup)
      return ''
    },
    selectedDryRun() {
      if (this.selectedKind === 'automation' && this.selectedId) {
        const data = this.dryRunResults[this.selectedId]
        return data ? this.formatDryRun(data) : ''
      }
      if (this.selectedKind === 'group' && this.selectedId) {
        const data = this.groupDryRunResults[this.selectedId]
        return data ? this.formatGroupDryRun(data) : ''
      }
      return ''
    },
    selectedLastRun() {
      if (this.selectedAutomation?.lastRun) {
        return summarizeAutomationRun(this.selectedAutomation.lastRun)
      }
      if (this.selectedGroup?.lastRun) {
        return summarizeGroupRun(this.selectedGroup.lastRun, this.automations)
      }
      return null
    },
    isRunningSelected() {
      if (!this.runningId || !this.selectedId) return false
      if (this.selectedKind === 'group') return this.runningId === this.groupRunningId(this.selectedId)
      return this.runningId === this.selectedId
    },
    runFeedbackClass() {
      if (this.runFeedbackStatus === 'success') return 'success'
      if (this.runFeedbackStatus === 'error') return 'error'
      return 'warning'
    },
    isNewEdit() {
      return !this.editAutomationId
    },
    basicsSummary() {
      if (!this.editForm) return ''
      const parts = []
      parts.push(this.editForm.name || 'Untitled')
      parts.push(this.editForm.enabled ? 'Enabled' : 'Disabled')
      parts.push(this.editForm.showOnDashboard ? 'On dashboard' : 'Hidden from dashboard')
      return parts.join(' · ')
    },
    conditionsSummary() {
      if (!this.editForm) return ''
      const logic = this.editForm.conditionLogic === 'any' ? 'any' : 'all'
      const conds = (this.editForm.conditions || []).map((c) => {
        const val =
          c.value?.mode === 'percent'
            ? `${c.value.amount}%`
            : c.valueInput
              ? `£${c.valueInput}`
              : formatMoney(c.value?.amount || 0)
        return `${c.operator} ${val}`
      })
      return conds.length
        ? `${conds.length} condition(s) · match ${logic}: ${conds.join(', ')}`
        : 'No conditions'
    },
    actionSummary() {
      if (!this.editForm?.action) return ''
      const action = this.editForm.action
      const type = action.type === 'deposit' ? 'Deposit' : 'Withdraw'
      const potId = action.type === 'deposit' ? action.destination?.id : action.source?.id
      const potName = this.pots.find((p) => p.id === potId)?.name || 'pot'
      const amt = action.amount
      let amtStr
      if (amt?.mode === 'percent') {
        amtStr = `${amt.value}%`
      } else if (amt?.mode === 'remainder') {
        amtStr = 'remainder above'
      } else if (amt?.mode === 'remainder_below') {
        amtStr = 'remainder below'
      } else {
        amtStr = this.editForm.actionAmountInput
          ? `£${this.editForm.actionAmountInput}`
          : formatMoney(amt?.value || 0)
      }
      return `${type} to ${potName} · ${amtStr}`
    },
    editDryRunMessage() {
      if (!this.editDryRunResult) return ''
      if (!this.editDryRunResult.conditionsMet) return 'Conditions not met'
      return `Would transfer ${formatMoney(this.editDryRunResult.transferAmount)}`
    }
  },
  watch: {
    '$route.query.edit': {
      immediate: false,
      handler(edit) {
        if (edit) {
          this.handleRouteEdit(edit)
        }
      }
    }
  },
  async mounted() {
    await this.initEditorContext()
    await this.load()
    if (this.$route.query.edit) {
      await this.handleRouteEdit(this.$route.query.edit)
    }
  },
  methods: {
    runStatusLabel,
    runStatusClass(status) {
      if (status === 'success') return 'run-success'
      if (status === 'skipped') return 'run-skipped'
      if (status === 'error') return 'run-error'
      return ''
    },
    automationRunSummary(auto) {
      return summarizeAutomationRun(auto.lastRun)
    },
    groupRunSummary(group) {
      return summarizeGroupRun(group.lastRun, this.automations)
    },
    groupRunningId(id) {
      return `group:${id}`
    },
    setRunFeedback(status, message) {
      this.runFeedbackStatus = status
      this.runFeedback = message
    },
    async initEditorContext() {
      const vault = useVaultStore()
      const status = await vault.refreshStatus()
      this.accountId = status.accountId || ''
      const { data: potsRes } = await monzoApi.pots()
      this.pots = potsRes.pots || []
    },
    clearEditQuery() {
      if (this.$route.query.edit) {
        this.$router.replace({ name: 'Automations', query: {} })
      }
    },
    async handleRouteEdit(edit) {
      if (edit === 'new') {
        await this.startNewEdit()
      } else {
        await this.startEdit(edit)
      }
    },
    selectItem(kind, id) {
      if (this.editMode) {
        this.cancelEdit()
      }
      this.selectedKind = kind
      this.selectedId = id
      this.runFeedback = ''
      this.runFeedbackStatus = ''
    },
    async load() {
      this.loading = true
      try {
        const [autosRes, groupsRes] = await Promise.all([
          automationsApi.list(),
          automationGroupsApi.list()
        ])
        this.automations = autosRes.data.automations || []
        this.groups = groupsRes.data.groups || []
        if (this.selectedId && !this.editMode) {
          const stillExists =
            (this.selectedKind === 'automation' && this.automations.some((a) => a.id === this.selectedId)) ||
            (this.selectedKind === 'group' && this.groups.some((g) => g.id === this.selectedId))
          if (!stillExists) {
            this.selectedKind = null
            this.selectedId = null
          }
        }
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.loading = false
      }
    },
    async startNewEdit() {
      this.editForm = defaultForm(this.accountId)
      if (this.pots[0]) {
        this.editForm.action.destination.id = this.pots[0].id
      }
      this.editAutomationId = null
      this.editMode = true
      this.editError = ''
      this.editDryRunResult = null
      this.activeEditModal = null
      this.runFeedback = ''
      this.runFeedbackStatus = ''
    },
    async startEdit(id) {
      this.editError = ''
      this.editDryRunResult = null
      this.activeEditModal = null
      try {
        const { data } = await automationsApi.get(id)
        this.editForm = automationToForm(data.automation)
        this.editAutomationId = id
        this.editMode = true
        this.selectedKind = 'automation'
        this.selectedId = id
        this.leftTab = 'rules'
        this.runFeedback = ''
        this.runFeedbackStatus = ''
      } catch (e) {
        this.editError = e.response?.data?.error || e.message
      }
    },
    cancelEdit() {
      this.editMode = false
      this.editForm = null
      this.editAutomationId = null
      this.activeEditModal = null
      this.editError = ''
      this.editDryRunResult = null
      this.clearEditQuery()
    },
    async saveEdit() {
      this.editError = ''
      try {
        const payload = formToPayload(this.editForm, this.accountId)
        let savedId = this.editAutomationId
        if (this.isNewEdit) {
          const { data } = await automationsApi.create(payload)
          savedId = data.automation.id
        } else {
          await automationsApi.update(this.editAutomationId, payload)
        }
        this.editMode = false
        this.editForm = null
        this.editAutomationId = null
        this.activeEditModal = null
        this.editDryRunResult = null
        this.clearEditQuery()
        await this.load()
        if (savedId) {
          this.selectedKind = 'automation'
          this.selectedId = savedId
        }
      } catch (e) {
        this.editError = e.response?.data?.error || e.message
      }
    },
    async dryRunEdit() {
      this.editError = ''
      try {
        const payload = formToPayload(this.editForm, this.accountId)
        let id = this.editAutomationId
        if (this.isNewEdit) {
          const { data } = await automationsApi.create(payload)
          id = data.automation.id
          this.editAutomationId = id
        } else {
          await automationsApi.update(id, payload)
        }
        const { data } = await automationsApi.dryRun(id)
        this.editDryRunResult = data
        await this.load()
        this.selectedKind = 'automation'
        this.selectedId = id
      } catch (e) {
        this.editError = e.response?.data?.error || e.message
      }
    },
    createNew() {
      this.startNewEdit()
      this.$router.replace({ name: 'Automations', query: { edit: 'new' } })
    },
    createGroup() {
      this.$router.push({ name: 'AutomationGroupNew' })
    },
    edit(id) {
      this.startEdit(id)
      this.$router.replace({ name: 'Automations', query: { edit: id } })
    },
    editGroup(id) {
      this.$router.push({ name: 'AutomationGroupEditor', params: { id } })
    },
    summarize(auto) {
      const conds = (auto.conditions || [])
        .map((c) => `${c.operator} ${c.value?.mode === 'percent' ? c.value.amount + '%' : formatMoney(c.value?.amount)}`)
        .join(` ${auto.conditionLogic || 'all'} `)
      const amt = auto.action?.amount
      const amtStr =
        amt?.mode === 'percent'
          ? `${amt.value}%`
          : amt?.mode === 'remainder'
            ? 'remainder above'
            : amt?.mode === 'remainder_below'
              ? 'remainder below'
              : formatMoney(amt?.value)
      return `${conds || 'no conditions'} → ${auto.action?.type} ${amtStr}`
    },
    summarizeGroup(group) {
      const names = (group.automationIds || [])
        .map((id) => this.automations.find((a) => a.id === id)?.name || 'Unknown')
      return names.length ? names.join(' → ') : 'No members'
    },
    async dryRun(id) {
      const { data } = await automationsApi.dryRun(id)
      this.dryRunResults = { ...this.dryRunResults, [id]: data }
    },
    formatDryRun(data) {
      if (!data.conditionsMet) return 'Conditions not met'
      return `Would transfer ${formatMoney(data.transferAmount)}`
    },
    async dryRunGroup(id) {
      const { data } = await automationGroupsApi.dryRun(id)
      this.groupDryRunResults = { ...this.groupDryRunResults, [id]: data }
    },
    formatGroupDryRun(data) {
      const steps = (data.steps || [])
        .map((s) => {
          if (!s.conditionsMet || s.transferAmount <= 0) return `${s.name}: skip`
          return `${s.name}: ${formatMoney(s.transferAmount)}`
        })
        .join(' · ')
      return `Total ${formatMoney(data.totalTransferAmount || 0)} — ${steps}`
    },
    async run(id) {
      this.runningId = id
      this.setRunFeedback('', '')
      try {
        const { data } = await automationsApi.run(id)
        if (data.status === 'success') {
          this.setRunFeedback('success', `Transferred ${formatMoney(data.amount)}`)
        } else if (data.status === 'error') {
          this.setRunFeedback('error', data.message || 'Run failed')
        } else {
          this.setRunFeedback('skipped', data.message || 'Automation skipped')
        }
        await this.load()
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      } finally {
        this.runningId = null
      }
    },
    async runGroup(id) {
      this.runningId = this.groupRunningId(id)
      this.setRunFeedback('', '')
      try {
        const { data } = await automationGroupsApi.run(id)
        if (data.status === 'success') {
          const count = (data.results || []).filter((r) => r.status === 'success').length
          this.setRunFeedback('success', data.message || `Ran ${count} automation(s)`)
        } else if (data.status === 'error') {
          this.setRunFeedback('error', data.message || 'Group run failed')
        } else {
          this.setRunFeedback('skipped', data.message || 'No automations ran')
        }
        await this.load()
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      } finally {
        this.runningId = null
      }
    },
    async remove(id) {
      if (!confirm('Delete this automation?')) return
      await automationsApi.delete(id)
      if (this.selectedKind === 'automation' && this.selectedId === id) {
        this.selectedKind = null
        this.selectedId = null
      }
      await this.load()
    },
    async removeGroup(id) {
      if (!confirm('Delete this automation group?')) return
      await automationGroupsApi.delete(id)
      if (this.selectedKind === 'group' && this.selectedId === id) {
        this.selectedKind = null
        this.selectedId = null
      }
      await this.load()
    }
  }
}
</script>

<style scoped>
.automations-view {
  height: 100%;
  min-height: 0;
}

.detail-name {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 500;
}

.edit-hint {
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

.section-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.section-card {
  cursor: pointer;
}

.section-chevron {
  color: var(--sw-text-muted);
  font-size: 1.1rem;
}

.cond-summary {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.running-note {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--sw-blue-bright);
}

.never-run {
  margin: 1rem 0 0;
  font-size: 0.85rem;
}

.run-history-label {
  margin: 0;
  color: var(--sw-text-secondary);
}

.dry-result {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: var(--sw-blue-bright);
}

.center-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

:deep(.sidebar-content .base-button) {
  width: 100%;
  margin-bottom: 8px;
}
</style>
