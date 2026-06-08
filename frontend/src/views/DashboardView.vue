<template>
  <div class="dashboard-view">
    <AppletShell
      v-model:left-visible="leftVisible"
      v-model:right-visible="rightVisible">
      <template #left>
        <SidebarPanel embedded title="Pots" :tabs="[]" default-tab="">
          <div data-sidebar-stagger-root>
            <p v-if="loading" class="sw-empty">Loading...</p>
            <div
              v-for="pot in pots"
              :key="pot.id"
              class="sw-list-row">
              <span>{{ pot.name }}</span>
              <span class="sw-list-meta">{{ formatMoney(pot.balance) }}</span>
            </div>
            <p v-if="!loading && !pots.length" class="sw-empty">No pots</p>
            <p v-if="pots.length && !loading" class="sw-muted pots-total">
              Total in pots {{ formatMoney(potsTotal) }}
            </p>
          </div>
        </SidebarPanel>
      </template>

      <div class="applet-center dashboard-center">
        <div class="dashboard-inner">
        <header class="dash-header">
          <h1>Dashboard</h1>
          <div class="dash-header-actions">
            <div class="period-toggle" role="group" aria-label="Analytics period">
              <button
                type="button"
                class="period-toggle__btn"
                :class="{ active: period === 'mtd' }"
                @click="period = 'mtd'">
                MTD
              </button>
              <button
                type="button"
                class="period-toggle__btn"
                :class="{ active: period === 'ytd' }"
                @click="period = 'ytd'">
                YTD
              </button>
            </div>
            <BaseButton variant="secondary" text="Refresh" @click="loadAll" />
          </div>
        </header>

        <p v-if="loadError" class="sw-message error">{{ loadError }}</p>
        <p v-if="period === 'ytd' && ytd?.incomplete" class="sw-message warning">
          {{ ytd.incompleteReason }}
        </p>
        <p
          v-if="runFeedback"
          class="sw-message"
          :class="runFeedbackClass">
          {{ runFeedback }}
        </p>

        <section class="automation-strip">
          <h2 class="sw-section-title">Quick automations</h2>
          <div v-if="dashboardAutomations.length || dashboardGroups.length" class="automation-buttons">
            <button
              v-for="auto in dashboardAutomations"
              :key="auto.id"
              class="auto-btn"
              :class="automationRunClass(auto)"
              :disabled="!!runningId"
              @click="runAutomation(auto)">
              {{ runningId === auto.id ? 'Running…' : auto.name }}
              <span v-if="runningId !== auto.id && automationRunSummary(auto)" class="auto-last" :class="runStatusClass(automationRunSummary(auto).status)">
                {{ automationRunSummary(auto).time }} · {{ automationRunSummary(auto).short }}
              </span>
              <span v-else-if="runningId !== auto.id" class="auto-last">Never run</span>
            </button>
            <button
              v-for="group in dashboardGroups"
              :key="group.id"
              class="auto-btn group-btn"
              :class="groupRunClass(group)"
              :disabled="!!runningId"
              @click="runGroup(group)">
              {{ runningId === groupRunningId(group.id) ? 'Running…' : group.name }}
              <span v-if="runningId !== groupRunningId(group.id)" class="auto-meta">{{ (group.automationIds || []).length }} steps</span>
              <span v-if="runningId !== groupRunningId(group.id) && groupRunSummary(group)" class="auto-last" :class="runStatusClass(groupRunSummary(group).status)">
                {{ groupRunSummary(group).time }} · {{ groupRunSummary(group).short }}
              </span>
              <span v-else-if="runningId !== groupRunningId(group.id)" class="auto-last">Never run</span>
            </button>
          </div>
          <p v-else-if="!loading" class="sw-empty automation-empty">
            No quick automations yet. Enable rules and tick “Show on dashboard” in the automations editor.
          </p>
        </section>

        <div class="hero-grid">
          <BalanceHeroCard :balance="balance" />
          <MetricCard
            :label="`${periodLabel} income`"
            :value="analytics?.totalIncome"
            :daily-series="analytics?.dailySeries || []"
            series-key="income"
            tone="positive" />
          <MetricCard
            :label="`${periodLabel} spend`"
            :value="analytics?.totalSpend"
            :daily-series="analytics?.dailySeries || []"
            series-key="spend"
            tone="negative" />
        </div>

        <div class="chart-grid">
          <TrendLineChart :daily-series="analytics?.dailySeries || []" :period="period" />
          <CategoryDonutChart :by-category="analytics?.byCategory || {}" :period="period" />
        </div>

        <BudgetProgressList
          :budget-status="period === 'mtd' ? (projections?.budgetStatus || {}) : {}"
          :by-category="analytics?.byCategory || {}" />

        <section class="summary-row panel">
          <div class="summary-stat">
            <span class="summary-label">{{ periodLabel }} spend</span>
            <span class="summary-value">{{ formatMoney(analytics?.totalSpend) }}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">{{ periodLabel }} net</span>
            <span class="summary-value" :class="summaryNetClass">{{ formatMoney(analytics?.net) }}</span>
          </div>
          <p v-if="projections && period === 'mtd'" class="summary-projection muted">
            Month-end pace: spend {{ formatMoney(projections.projectedMonthSpend) }},
            balance {{ formatMoney(projections.projectedMonthEndBalance) }}
          </p>
        </section>
        </div>
      </div>

      <template #right>
        <SidebarPanel
          ref="transactionsSidebar"
          embedded
          title="Transactions"
          :is-right="true"
          :tabs="[]"
          default-tab=""
          @content-scroll="onTransactionsScroll">
          <div data-sidebar-stagger-root>
            <p v-if="transactionsLoading && !transactionMonths.length" class="sw-empty">Loading...</p>
            <template v-for="group in transactionMonths" :key="group.key">
              <h3 class="tx-month-header">{{ group.label }}</h3>
              <div v-for="tx in group.transactions" :key="tx.id" class="sw-list-row tx-row">
                <div class="tx-body">
                  <span class="tx-desc">{{ tx.description }}</span>
                  <span class="tx-meta">
                    {{ formatCategory(tx.category) }} · {{ formatDay(tx.created) }}
                  </span>
                </div>
                <span class="tx-amount" :class="{ credit: tx.amount > 0 }">
                  {{ formatMoney(tx.amount) }}
                </span>
              </div>
              <p v-if="!group.transactions.length" class="sw-empty tx-month-empty">No transactions</p>
            </template>
            <p v-if="transactionsLoadingMore" class="sw-empty tx-feed-status">Loading more...</p>
            <p v-else-if="transactionsEndMessage" class="sw-empty tx-feed-status sw-muted">
              {{ transactionsEndMessage }}
            </p>
            <p
              v-if="!transactionsLoading && !transactionMonths.length"
              class="sw-empty">
              No transactions
            </p>
          </div>
        </SidebarPanel>
      </template>
    </AppletShell>

    <BaseModal
      :is-open="!!confirmTarget"
      :title="confirmTitle"
      @close="confirmTarget = null">
      <p>{{ confirmMessage }}</p>
      <ul v-if="confirmSteps.length" class="confirm-steps">
        <li v-for="step in confirmSteps" :key="step.name">
          {{ step.name }}: {{ step.label }}
        </li>
      </ul>
      <div class="modal-actions">
        <BaseButton variant="secondary" text="Cancel" @click="confirmTarget = null" />
        <BaseButton text="Run" @click="confirmRun" />
      </div>
    </BaseModal>
  </div>
</template>

<script>
import { AppletShell, SidebarPanel, BaseButton, BaseModal } from '../components/common'
import BalanceHeroCard from '../components/dashboard/BalanceHeroCard.vue'
import MetricCard from '../components/dashboard/MetricCard.vue'
import TrendLineChart from '../components/dashboard/TrendLineChart.vue'
import CategoryDonutChart from '../components/dashboard/CategoryDonutChart.vue'
import BudgetProgressList from '../components/dashboard/BudgetProgressList.vue'
import { monzoApi, analyticsApi, automationsApi, automationGroupsApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import { formatCategory, formatDay, monthFeedToColumn } from '../utils/transactions.js'
import { summarizeAutomationRun, summarizeGroupRun } from '../utils/automationRuns.js'

const CONFIRM_THRESHOLD = 5000

export default {
  name: 'DashboardView',
  components: {
    AppletShell,
    SidebarPanel,
    BaseButton,
    BaseModal,
    BalanceHeroCard,
    MetricCard,
    TrendLineChart,
    CategoryDonutChart,
    BudgetProgressList
  },
  data() {
    return {
      leftVisible: true,
      rightVisible: true,
      loading: false,
      balance: null,
      pots: [],
      transactionMonths: [],
      transactionsLoading: false,
      transactionsLoadingMore: false,
      transactionsHasMore: false,
      transactionsNextMonth: null,
      transactionsEndMessage: '',
      period: 'mtd',
      mtd: null,
      ytd: null,
      projections: null,
      automations: [],
      groups: [],
      runningId: null,
      confirmTarget: null,
      confirmPreview: null,
      loadError: '',
      runFeedback: '',
      runFeedbackStatus: ''
    }
  },
  computed: {
    periodLabel() {
      return this.period === 'ytd' ? 'YTD' : 'MTD'
    },
    analytics() {
      return this.period === 'ytd' ? this.ytd : this.mtd
    },
    summaryNetClass() {
      return (this.analytics?.net || 0) >= 0 ? 'positive' : 'negative'
    },
    potsTotal() {
      return this.pots.reduce((sum, p) => sum + (p.balance || 0), 0)
    },
    dashboardAutomations() {
      return this.automations.filter((a) => a.enabled && a.showOnDashboard !== false)
    },
    dashboardGroups() {
      return this.groups.filter((g) => g.enabled && g.showOnDashboard !== false)
    },
    confirmTitle() {
      if (!this.confirmTarget) return 'Confirm'
      return `Run ${this.confirmTarget.name}?`
    },
    confirmMessage() {
      if (!this.confirmTarget || !this.confirmPreview) return ''
      if (this.confirmTarget.kind === 'group') {
        const count = (this.confirmTarget.automationIds || []).length
        return `Transfer up to ${formatMoney(this.confirmPreview.totalTransferAmount || 0)} across ${count} steps if conditions are met.`
      }
      return `Transfer up to ${formatMoney(this.confirmPreview.transferAmount || 0)} if conditions are met.`
    },
    confirmSteps() {
      if (!this.confirmPreview?.steps) return []
      return this.confirmPreview.steps.map((s) => ({
        name: s.name,
        label:
          s.conditionsMet && s.transferAmount > 0
            ? formatMoney(s.transferAmount)
            : 'skip'
      }))
    },
    runFeedbackClass() {
      if (this.runFeedbackStatus === 'success') return 'success'
      if (this.runFeedbackStatus === 'error') return 'error'
      return 'warning'
    }
  },
  mounted() {
    this.loadAll()
    this.loadTransactions()
  },
  methods: {
    formatMoney,
    formatCategory,
    formatDay,
    formatDate(iso) {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    },
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
    automationRunClass(auto) {
      const summary = this.automationRunSummary(auto)
      return summary ? this.runStatusClass(summary.status) : ''
    },
    groupRunClass(group) {
      const summary = this.groupRunSummary(group)
      return summary ? this.runStatusClass(summary.status) : ''
    },
    setRunFeedback(status, message) {
      this.runFeedbackStatus = status
      this.runFeedback = message
    },
    applyTransactionMonthFeed(data, { append = false } = {}) {
      const group = monthFeedToColumn(data)

      if (append) {
        const seen = new Set(this.transactionMonths.map((m) => m.key))
        if (!seen.has(group.key)) {
          this.transactionMonths.push(group)
        }
      } else {
        this.transactionMonths = [group]
      }

      this.transactionsHasMore = Boolean(data.hasMore)
      this.transactionsNextMonth = data.nextMonth || null

      if (data.verificationRequired && data.message) {
        this.transactionsEndMessage = data.message
        this.transactionsHasMore = false
        this.transactionsNextMonth = null
      }
    },
    isTransactionsScrollable() {
      const el = this.$refs.transactionsSidebar?.getScrollElement?.()
      if (!el) return false
      return el.scrollHeight > el.clientHeight + 1
    },
    async prefetchTransactionMonthsIfNeeded() {
      let attempts = 0
      while (
        this.transactionsHasMore &&
        this.transactionsNextMonth &&
        !this.transactionsLoading &&
        !this.transactionsLoadingMore &&
        attempts < 6
      ) {
        await this.$nextTick()
        if (this.isTransactionsScrollable()) break
        await this.loadMoreTransactions()
        attempts++
      }
    },
    async loadTransactions() {
      this.transactionsLoading = true
      this.transactionsEndMessage = ''
      this.transactionsHasMore = false
      this.transactionsNextMonth = null
      this.transactionMonths = []
      try {
        const { data } = await monzoApi.transactionMonth()
        this.applyTransactionMonthFeed(data)
        await this.prefetchTransactionMonthsIfNeeded()
      } catch (e) {
        this.transactionMonths = []
        this.loadError = this.loadError || e.response?.data?.error || e.message
      } finally {
        this.transactionsLoading = false
      }
    },
    async loadMoreTransactions() {
      if (
        this.transactionsLoading ||
        this.transactionsLoadingMore ||
        !this.transactionsHasMore ||
        !this.transactionsNextMonth
      ) {
        return
      }
      this.transactionsLoadingMore = true
      try {
        const { data } = await monzoApi.transactionMonth(this.transactionsNextMonth)
        this.applyTransactionMonthFeed(data, { append: true })
        if (!data.hasMore && !data.verificationRequired) {
          this.transactionsEndMessage = this.transactionsEndMessage || 'No more transactions.'
        }
      } catch (e) {
        this.transactionsHasMore = false
        this.transactionsEndMessage = e.response?.data?.error || e.message
      } finally {
        this.transactionsLoadingMore = false
        await this.prefetchTransactionMonthsIfNeeded()
      }
    },
    onTransactionsScroll({ scrollTop, el }) {
      if (!el) return
      const distanceFromBottom = el.scrollHeight - el.clientHeight - scrollTop
      if (distanceFromBottom < 120) {
        this.loadMoreTransactions()
      }
    },
    async loadAll() {
      this.loading = true
      this.loadError = ''
      const results = await Promise.allSettled([
        monzoApi.balance(),
        monzoApi.pots(),
        analyticsApi.summary('mtd'),
        analyticsApi.summary('ytd'),
        analyticsApi.projections(),
        automationsApi.list(),
        automationGroupsApi.list()
      ])
      const [bal, potsRes, mtd, ytd, proj, autos, groupsRes] = results
      const errors = []

      if (bal.status === 'fulfilled') this.balance = bal.value.data
      else errors.push('balance')

      if (potsRes.status === 'fulfilled') this.pots = potsRes.value.data.pots || []
      else errors.push('pots')

      if (mtd.status === 'fulfilled') this.mtd = mtd.value.data
      else errors.push('mtd analytics')

      if (ytd.status === 'fulfilled') this.ytd = ytd.value.data
      else errors.push('ytd analytics')
      if (proj.status === 'fulfilled') this.projections = proj.value.data

      if (autos.status === 'fulfilled') this.automations = autos.value.data.automations || []
      else errors.push('automations')

      if (groupsRes.status === 'fulfilled') this.groups = groupsRes.value.data.groups || []

      if (errors.length) {
        const first = results.find((r) => r.status === 'rejected')
        const msg = first?.reason?.response?.data?.error || first?.reason?.message
        this.loadError = msg
          ? `Some data failed to load: ${msg}`
          : 'Some dashboard data failed to load. Check vault and Monzo connection in Settings.'
      }

      this.loading = false
    },
    groupRunningId(id) {
      return `group:${id}`
    },
    async runAutomation(auto) {
      this.runFeedback = ''
      try {
        const { data: preview } = await automationsApi.dryRun(auto.id)
        if (preview.transferAmount >= CONFIRM_THRESHOLD) {
          this.confirmTarget = { kind: 'automation', ...auto }
          this.confirmPreview = preview
          return
        }
        await this.executeRun(auto.id)
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      }
    },
    async runGroup(group) {
      this.runFeedback = ''
      try {
        const { data: preview } = await automationGroupsApi.dryRun(group.id)
        if ((preview.totalTransferAmount || 0) >= CONFIRM_THRESHOLD) {
          this.confirmTarget = { kind: 'group', ...group }
          this.confirmPreview = preview
          return
        }
        await this.executeGroupRun(group.id)
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      }
    },
    async confirmRun() {
      const target = this.confirmTarget
      this.confirmTarget = null
      this.confirmPreview = null
      if (!target) return
      if (target.kind === 'group') {
        await this.executeGroupRun(target.id)
      } else {
        await this.executeRun(target.id)
      }
    },
    async executeRun(id) {
      this.runningId = id
      try {
        const { data } = await automationsApi.run(id)
        if (data.status === 'success') {
          this.setRunFeedback('success', `Transferred ${formatMoney(data.amount)}`)
          await this.loadAll()
        } else if (data.status === 'error') {
          this.setRunFeedback('error', data.message || 'Run failed')
          await this.loadAll()
        } else {
          this.setRunFeedback('skipped', data.message || 'Automation skipped')
          await this.loadAll()
        }
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      } finally {
        this.runningId = null
      }
    },
    async executeGroupRun(id) {
      this.runningId = this.groupRunningId(id)
      try {
        const { data } = await automationGroupsApi.run(id)
        if (data.status === 'success') {
          this.setRunFeedback('success', data.message || 'Group run completed')
          await this.loadAll()
        } else if (data.status === 'error') {
          this.setRunFeedback('error', data.message || 'Group run failed')
          await this.loadAll()
        } else {
          this.setRunFeedback('skipped', data.message || 'No automations ran')
          await this.loadAll()
        }
      } catch (e) {
        this.setRunFeedback('error', e.response?.data?.error || e.message)
      } finally {
        this.runningId = null
      }
    }
  }
}
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  min-height: 0;
}

.dashboard-center {
  padding: 12px 14px;
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.dash-header h1 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--sw-text-primary);
}

.dash-header-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.period-toggle {
  display: inline-flex;
  background: var(--sw-applet-segmented-bg);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-chrome-radius-inner);
  padding: 2px;
}

.period-toggle__btn {
  background: transparent;
  border: none;
  color: var(--sw-text-muted);
  padding: 0.35rem 0.7rem;
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.period-toggle__btn:hover {
  color: var(--sw-text-primary);
}

.period-toggle__btn.active {
  background: var(--sw-panel);
  color: var(--sw-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.hero-grid,
.chart-grid {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
}

.hero-grid {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.chart-grid {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}

.hero-grid > *,
.chart-grid > * {
  min-width: 0;
  max-width: 100%;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.5rem;
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-label {
  font-size: 0.7rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-value {
  font-size: 1.1rem;
  font-weight: 600;
}

.summary-value.positive { color: var(--sw-success); }
.summary-value.negative { color: var(--sw-danger-soft); }

.summary-projection {
  margin: 0;
  font-size: 0.85rem;
  flex: 1;
  min-width: 200px;
}

.panel {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  padding: 0.85rem 1rem;
}

.pots-total {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  text-align: right;
}

.tx-month-header {
  margin: 1rem 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
}

.tx-month-header:first-child {
  margin-top: 0;
}

.tx-month-empty {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
}

.tx-row {
  cursor: default;
  align-items: flex-start;
}

.tx-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.tx-desc {
  font-size: 0.85rem;
  color: var(--sw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-amount {
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--sw-danger-soft);
  flex-shrink: 0;
}

.tx-amount.credit { color: var(--sw-success); }

.tx-meta {
  font-size: 0.72rem;
  color: var(--sw-text-muted);
  text-transform: capitalize;
}

.automation-strip {
  margin: 0;
}

.automation-strip .sw-section-title {
  margin-bottom: 0.5rem;
}

.automation-empty {
  padding: 0.5rem 0;
  margin: 0;
}

.automation-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.auto-btn {
  background: var(--sw-applet-segmented-bg);
  border: none;
  color: var(--sw-text-secondary);
  padding: 0.65rem 0.85rem;
  border-radius: var(--sw-chrome-radius-inner);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-height: 44px;
  transition: background 0.15s ease, color 0.15s ease;
}

.auto-btn:hover:not(:disabled) {
  background: var(--sw-panel-raised);
  color: var(--sw-text-primary);
}

.auto-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-btn .auto-meta {
  color: var(--sw-blue-bright);
}

.auto-meta {
  font-size: 0.7rem;
  color: var(--sw-blue-bright);
}

.auto-last {
  font-size: 0.7rem;
  color: var(--sw-text-muted);
}

.auto-last.run-success {
  color: var(--sw-success);
}

.auto-last.run-skipped {
  color: var(--sw-accent-orange);
}

.auto-last.run-error {
  color: var(--sw-danger-soft);
}

.confirm-steps {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: var(--sw-text-secondary);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

@media (max-width: 900px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
