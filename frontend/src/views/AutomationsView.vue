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
                <span class="sw-secondary list-description">{{ automationOneLine(auto) }}</span>
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
                <span class="sw-secondary list-description">{{ groupOneLine(group) }}</span>
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

            <SectionNavBar
              v-model="activeEditSection"
              :tabs="editSections" />

            <AutomationSectionPanel
              :form="editForm"
              :pots="pots"
              :account-id="accountId"
              :active-section="activeEditSection" />

            <div v-if="editDescription" class="automation-description edit-preview">
              <p><span class="sw-label">When</span> {{ editDescription.when }}</p>
              <p><span class="sw-label">Then</span> {{ editDescription.then }}</p>
              <p v-if="editDescription.auto"><span class="sw-label">Auto</span> {{ editDescription.auto }}</p>
            </div>

            <p v-if="editDryRunResult" class="dry-result">{{ editDryRunMessage }}</p>
            <p v-if="editError" class="sw-message error">{{ editError }}</p>
          </template>

          <template v-else-if="selectedItem">
            <header class="detail-header">
              <button type="button" class="detail-back" @click="clearSelection">
                ← Back
              </button>
            </header>
            <h2 class="detail-name">{{ selectedItem.name }}</h2>
            <div v-if="selectedAutomationDescription" class="automation-description">
              <p><span class="sw-label">When</span> {{ selectedAutomationDescription.when }}</p>
              <p><span class="sw-label">Then</span> {{ selectedAutomationDescription.then }}</p>
              <p v-if="selectedAutomationDescription.auto">
                <span class="sw-label">Auto</span> {{ selectedAutomationDescription.auto }}
              </p>
            </div>
            <div v-else-if="selectedGroupDescription" class="automation-description">
              <p class="sw-secondary group-intro">{{ selectedGroupDescription.summary }}</p>
              <p v-if="selectedGroupDescription.auto" class="sw-secondary group-intro">
                <span class="sw-label">Auto</span> {{ selectedGroupDescription.auto }}
              </p>
              <ol v-if="selectedGroupDescription.steps.length" class="group-steps">
                <li v-for="(step, i) in selectedGroupDescription.steps" :key="i">
                  <span class="step-name">{{ step.name }}</span>
                  <span class="step-detail">{{ step.summary }}</span>
                </li>
              </ol>
            </div>
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
              <BaseButton variant="secondary" text="Back" @click="clearSelection" />
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
              <BaseButton variant="secondary" text="Back" @click="clearSelection" />
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
import { AppletShell, SidebarPanel, BaseButton, SectionNavBar } from '../components/common'
import AutomationSectionPanel from '../components/automations/AutomationSectionPanel.vue'
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
import {
  describeAutomation,
  describeAutomationOneLine,
  describeGroup as buildGroupDescription
} from '../utils/automationDisplay.js'
import { useVaultStore } from '../stores/vault.js'

export default {
  name: 'AutomationsView',
  components: { AppletShell, SidebarPanel, BaseButton, SectionNavBar, AutomationSectionPanel },
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
      activeEditSection: 'basics',
      editSections: [
        { id: 'basics', label: 'Basics' },
        { id: 'conditions', label: 'Conditions' },
        { id: 'action', label: 'Action' },
        { id: 'autotrigger', label: 'Auto-run' }
      ],
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
    displayContext() {
      return { pots: this.pots, accountLabel: 'Main account' }
    },
    selectedAutomationDescription() {
      if (!this.selectedAutomation) return null
      return describeAutomation(this.selectedAutomation, this.displayContext)
    },
    selectedGroupDescription() {
      if (!this.selectedGroup) return null
      return buildGroupDescription(this.selectedGroup, this.automations, this.displayContext)
    },
    editDescription() {
      if (!this.editForm) return null
      return describeAutomation(formToPayload(this.editForm, this.accountId), this.displayContext)
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
    automationOneLine(auto) {
      return describeAutomationOneLine(auto, this.displayContext)
    },
    groupOneLine(group) {
      return buildGroupDescription(group, this.automations, this.displayContext).summary
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
    clearSelection() {
      this.selectedKind = null
      this.selectedId = null
      this.runFeedback = ''
      this.runFeedbackStatus = ''
    },
    selectItem(kind, id) {
      if (this.editMode) {
        this.cancelEdit()
      }
      if (this.selectedKind === kind && this.selectedId === id && !this.editMode) {
        this.clearSelection()
        return
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
            this.clearSelection()
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
      this.activeEditSection = 'basics'
      this.runFeedback = ''
      this.runFeedbackStatus = ''
    },
    async startEdit(id) {
      this.editError = ''
      this.editDryRunResult = null
      this.activeEditSection = 'basics'
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
      this.activeEditSection = 'basics'
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
        this.activeEditSection = 'basics'
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
        this.clearSelection()
      }
      await this.load()
    },
    async removeGroup(id) {
      if (!confirm('Delete this automation group?')) return
      await automationGroupsApi.delete(id)
      if (this.selectedKind === 'group' && this.selectedId === id) {
        this.clearSelection()
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

.detail-header {
  margin: 0 0 0.75rem;
}

.detail-back {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--sw-text-secondary, #a0aec0);
  transition: color 0.2s ease;
}

.detail-back:hover {
  color: var(--sw-text-primary, #e5e7eb);
}

.detail-name {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  font-weight: 500;
}

.list-description {
  display: block;
  margin: 0.15rem 0 0.25rem;
  font-size: 0.8rem;
  line-height: 1.35;
}

.automation-description {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.automation-description p {
  margin: 0 0 0.5rem;
}

.automation-description p:last-child {
  margin-bottom: 0;
}

.automation-description .sw-label {
  margin-right: 0.35rem;
}

.edit-preview {
  margin-top: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--sw-border);
  border-radius: 6px;
  background: var(--sw-panel-inset);
}

.group-intro {
  margin: 0 0 0.5rem;
}

.group-steps {
  margin: 0;
  padding-left: 1.25rem;
}

.group-steps li {
  margin-bottom: 0.5rem;
}

.group-steps li:last-child {
  margin-bottom: 0;
}

.step-name {
  display: block;
  font-weight: 500;
  margin-bottom: 0.15rem;
}

.step-detail {
  display: block;
  color: var(--sw-text-secondary);
  font-size: 0.85rem;
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
