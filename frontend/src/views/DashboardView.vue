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
        <p v-if="loadError" class="sw-message error">{{ loadError }}</p>
        <p
          v-if="runFeedback"
          class="sw-message"
          :class="runFeedbackClass">
          {{ runFeedback }}
        </p>

        <section class="automation-strip">
          <div class="automation-strip__header">
            <h2 class="sw-section-title">Quick automations</h2>
            <div class="automation-strip__actions">
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
                  :class="{
                    active: period === 'ytd',
                    'period-toggle__btn--incomplete': ytd?.incomplete
                  }"
                  :title="ytd?.incomplete ? ytd.incompleteReason : undefined"
                  :aria-label="ytd?.incomplete ? `YTD — ${ytd.incompleteReason}` : 'Year to date'"
                  @click="period = 'ytd'">
                  YTD
                </button>
              </div>
              <BaseButton variant="secondary" text="Refresh" @click="loadAll" />
            </div>
          </div>
          <div v-if="dashboardAutomations.length || dashboardGroups.length" class="automation-buttons">
            <button
              v-for="auto in dashboardAutomations"
              :key="auto.id"
              class="auto-btn"
              :class="automationRunClass(auto)"
              :disabled="!!runningId"
              @click="runAutomation(auto)">
              <span class="auto-btn__label">{{ runningId === auto.id ? 'Running…' : auto.name }}</span>
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
              <span class="auto-btn__label">{{ runningId === groupRunningId(group.id) ? 'Running…' : group.name }}</span>
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
          <ChartPanelShell @expand="openChartDetail('metric-income')">
            <template #title>
              <span class="metric-shell-title">{{ periodLabel }} income</span>
            </template>
            <MetricCard
              key="grid-metric-income"
              hide-label
              :label="`${periodLabel} income`"
              :value="analytics?.totalIncome"
              :daily-series="analytics?.dailySeries || []"
              series-key="income"
              tone="positive" />
          </ChartPanelShell>
          <ChartPanelShell @expand="openChartDetail('metric-spend')">
            <template #title>
              <span class="metric-shell-title">{{ periodLabel }} spend</span>
            </template>
            <MetricCard
              key="grid-metric-spend"
              hide-label
              :label="`${periodLabel} spend`"
              :value="analytics?.totalSpend"
              :daily-series="analytics?.dailySeries || []"
              series-key="spend"
              tone="negative" />
          </ChartPanelShell>
        </div>

        <div class="chart-grid">
          <ChartPanelShell @expand="openChartDetail('trend')">
            <template #title>
              <h2 class="chart-shell-title">Income vs spend ({{ periodLabel }})</h2>
            </template>
            <TrendLineChart
              key="grid-trend"
              hide-title
              :daily-series="analytics?.dailySeries || []"
              :period="period"
              @select-date="(payload) => onChartDateSelect('trend', payload)" />
          </ChartPanelShell>
          <ChartPanelShell @expand="openChartDetail('donut')">
            <template #title>
              <h2 class="chart-shell-title">Spending by category</h2>
            </template>
            <CategoryDonutChart
              key="grid-donut"
              hide-title
              :by-category="analytics?.byCategory || {}"
              :period="period"
              @select-category="(payload) => onChartCategorySelect('donut', payload)" />
          </ChartPanelShell>
        </div>

        <ChartPanelShell @expand="openChartDetail('budget')">
          <template #title>
            <h2 class="chart-shell-title">Spending categories</h2>
          </template>
          <BudgetProgressList
            key="grid-budget"
            hide-title
            embedded
            :budget-status="period === 'mtd' ? (projections?.budgetStatus || {}) : {}"
            :by-category="analytics?.byCategory || {}"
            :selected-category="chartDetailCategoryKey"
            @select-category="(payload) => onChartCategorySelect('budget', payload)"
            @saved="onBudgetsSaved" />
        </ChartPanelShell>

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

    <ChartDetailModal
      :is-open="!!chartDetail"
      :title="chartDetailTitle"
      :loading="chartDrilldownLoading"
      :selection-label="chartSelectionLabel"
      :selection-meta="chartSelectionMeta"
      :transactions="chartDrilldownTransactions"
      :show-transactions="!!chartDetail?.selection"
      :empty-message="chartEmptyMessage"
      @close="closeChartDetail"
      @clear-selection="clearChartSelection">
      <template #chart>
        <TrendLineChart
          v-if="chartDetail?.source === 'trend'"
          :key="chartModalKey"
          expanded
          hide-title
          :daily-series="analytics?.dailySeries || []"
          :period="period"
          :selected-date="chartDetail?.selection?.date"
          @select-date="(payload) => onChartDateSelect('trend', payload)" />
        <CategoryDonutChart
          v-else-if="chartDetail?.source === 'donut'"
          :key="chartModalKey"
          expanded
          hide-title
          :by-category="analytics?.byCategory || {}"
          :period="period"
          :selected-category="chartDetailCategorySelection"
          @select-category="(payload) => onChartCategorySelect('donut', payload)" />
        <BudgetProgressList
          v-else-if="chartDetail?.source === 'budget'"
          :key="chartModalKey"
          expanded
          hide-title
          embedded
          :budget-status="period === 'mtd' ? (projections?.budgetStatus || {}) : {}"
          :by-category="analytics?.byCategory || {}"
          :selected-category="chartDetailCategoryKey"
          @select-category="(payload) => onChartCategorySelect('budget', payload)"
          @saved="onBudgetsSaved" />
        <MetricCard
          v-else-if="chartDetail?.source === 'metric-income'"
          :key="chartModalKey"
          expanded
          hide-label
          :label="`${periodLabel} income`"
          :value="analytics?.totalIncome"
          :daily-series="analytics?.dailySeries || []"
          series-key="income"
          tone="positive"
          @select-date="(payload) => onChartDateSelect('metric-income', payload)" />
        <MetricCard
          v-else-if="chartDetail?.source === 'metric-spend'"
          :key="chartModalKey"
          expanded
          hide-label
          :label="`${periodLabel} spend`"
          :value="analytics?.totalSpend"
          :daily-series="analytics?.dailySeries || []"
          series-key="spend"
          tone="negative"
          @select-date="(payload) => onChartDateSelect('metric-spend', payload)" />
      </template>
    </ChartDetailModal>

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
import ChartPanelShell from '../components/charts/ChartPanelShell.vue'
import ChartDetailModal from '../components/charts/ChartDetailModal.vue'
import { monzoApi, analyticsApi, automationsApi, automationGroupsApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import { formatCategory, formatDay, monthFeedToColumn } from '../utils/transactions.js'
import { summarizeAutomationRun, summarizeGroupRun } from '../utils/automationRuns.js'
import {
  ensureTransactionsForPeriod,
  drilldownTransactions,
  selectionSummary
} from '../composables/useTransactionDrilldown.js'

const CONFIRM_THRESHOLD = 5000

export default {
  name: 'DashboardView',
  components: {
    AppletShell,
    SidebarPanel,
    BaseButton,
    BaseModal,
    ChartPanelShell,
    ChartDetailModal,
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
      runFeedbackStatus: '',
      chartDetail: null,
      chartDrilldownLoading: false,
      chartDrilldownTransactions: []
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
    },
    chartModalKey() {
      if (!this.chartDetail) return 'modal-chart'
      const sel = this.chartDetail.selection
      const category = sel?.category || (sel?.categories ? 'other' : '')
      const date = sel?.date || ''
      return `${this.chartDetail.source}-${category}-${date}`
    },
    chartDetailTitle() {
      if (!this.chartDetail) return ''
      const titles = {
        trend: `Income vs spend (${this.periodLabel})`,
        donut: `Spending by category (${this.periodLabel})`,
        budget: `Spending categories (${this.periodLabel})`,
        'metric-income': `${this.periodLabel} income`,
        'metric-spend': `${this.periodLabel} spend`
      }
      return titles[this.chartDetail.source] || 'Chart details'
    },
    chartDetailCategoryKey() {
      const sel = this.chartDetail?.selection
      if (!sel?.category || sel.category === 'other') return null
      return sel.category
    },
    chartDetailCategorySelection() {
      const sel = this.chartDetail?.selection
      if (!sel) return null
      if (sel.categories) return sel.categories
      return sel.category || null
    },
    chartSelectionLabel() {
      const sel = this.chartDetail?.selection
      if (!sel) return ''
      if (sel.label) return sel.label
      if (sel.date) {
        return new Date(sel.date + 'T12:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      }
      return ''
    },
    chartSelectionMeta() {
      const sel = this.chartDetail?.selection
      if (!sel || !this.chartDrilldownTransactions.length) return ''
      const summary = selectionSummary(this.chartDrilldownTransactions)
      const parts = [`${summary.count} transactions`]
      if (summary.spend > 0) parts.push(`spend ${formatMoney(summary.spend)}`)
      if (summary.income > 0) parts.push(`income ${formatMoney(summary.income)}`)
      return parts.join(' · ')
    },
    chartEmptyMessage() {
      const sel = this.chartDetail?.selection
      if (!sel) return 'No transactions'
      if (sel.date) return `No transactions on ${this.chartSelectionLabel}`
      if (sel.label) return `No ${sel.label} transactions for ${this.periodLabel}`
      return `No transactions for ${this.periodLabel}`
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
    openChartDetail(source) {
      this.chartDetail = { source, selection: null }
      this.chartDrilldownTransactions = []
      this.chartDrilldownLoading = false
    },
    closeChartDetail() {
      this.chartDetail = null
      this.chartDrilldownTransactions = []
      this.chartDrilldownLoading = false
    },
    clearChartSelection() {
      if (!this.chartDetail) return
      this.chartDetail = { ...this.chartDetail, selection: null }
      this.chartDrilldownTransactions = []
      this.chartDrilldownLoading = false
    },
    onChartCategorySelect(source, payload) {
      this.chartDetail = { source, selection: payload }
      this.loadChartDrilldown()
    },
    onChartDateSelect(source, payload) {
      const seriesKey =
        source === 'metric-income'
          ? 'income'
          : source === 'metric-spend'
            ? 'spend'
            : payload.seriesKey
      const selection = { ...payload, seriesKey: seriesKey || payload.seriesKey }
      this.chartDetail = { source, selection }
      this.loadChartDrilldown()
    },
    mergeTransactionMonths(columns) {
      const byKey = new Map(this.transactionMonths.map((col) => [col.key, col]))
      for (const col of columns) {
        byKey.set(col.key, col)
      }
      this.transactionMonths = [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key))
    },
    async loadChartDrilldown() {
      const sel = this.chartDetail?.selection
      if (!sel) {
        this.chartDrilldownTransactions = []
        return
      }

      this.chartDrilldownLoading = true
      try {
        const { columns, transactions } = await ensureTransactionsForPeriod({
          period: this.period,
          loadedMonths: this.transactionMonths,
          fetchMonth: async (monthKey) => {
            const { data } = await monzoApi.transactionMonth(monthKey)
            return data
          }
        })
        this.mergeTransactionMonths(columns)
        this.chartDrilldownTransactions = drilldownTransactions({
          transactions,
          category: sel.categories || sel.category,
          date: sel.date,
          seriesKey: sel.seriesKey
        })
      } catch (e) {
        this.chartDrilldownTransactions = []
        this.loadError = this.loadError || e.response?.data?.error || e.message
      } finally {
        this.chartDrilldownLoading = false
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
    async onBudgetsSaved() {
      try {
        const { data } = await analyticsApi.projections()
        this.projections = data
      } catch {
        // parent save message already shown; user can Refresh if needed
      }
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

.period-toggle {
  display: inline-flex;
  background: var(--sw-applet-segmented-bg);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-chrome-radius-inner);
  padding: 2px;
}

.period-toggle__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
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

.period-toggle__btn--incomplete {
  color: var(--sw-accent-orange);
}

.period-toggle__btn--incomplete::after {
  content: '';
  position: absolute;
  top: 0.2rem;
  right: 0.25rem;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 50%;
  background: var(--sw-accent-orange);
}

.period-toggle__btn:hover {
  color: var(--sw-text-primary);
}

.period-toggle__btn--incomplete:hover {
  color: var(--sw-accent-orange);
}

.period-toggle__btn.active {
  background: var(--sw-panel);
  color: var(--sw-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.period-toggle__btn.active.period-toggle__btn--incomplete {
  color: var(--sw-accent-orange);
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

.automation-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.automation-strip__header .sw-section-title {
  margin: 0;
}

.automation-strip__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.automation-empty {
  padding: 0.5rem 0;
  margin: 0;
}

.automation-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.5rem;
  width: 100%;
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
  width: 100%;
  min-width: 0;
  min-height: 44px;
  transition: background 0.15s ease, color 0.15s ease;
}

.auto-btn__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.metric-shell-title,
.chart-shell-title {
  margin: 0;
  font-size: 1rem;
  color: var(--sw-text-primary);
}

.metric-shell-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sw-text-muted);
}

.chart-grid :deep(.donut-chart),
.chart-grid :deep(.trend-chart),
:deep(.budget-progress) {
  border: none;
  padding: 0;
  background: transparent;
}

.hero-grid :deep(.metric-card) {
  border: none;
  padding: 0;
  background: transparent;
}

@media (max-width: 900px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .automation-strip__header {
    flex-direction: column;
    align-items: stretch;
  }

  .automation-strip__actions {
    justify-content: flex-end;
  }
}
</style>
