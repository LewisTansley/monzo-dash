<template>
  <div class="transactions-kanban-view">
    <AppletShell variant="bare">
      <div class="applet-center applet-center--full-bleed">
      <div class="kanban-shell">
        <header class="kanban-header">
          <p class="sw-muted kanban-hint">Scroll right for older months · scroll inside a column for that month&apos;s transactions</p>
        </header>

        <p v-if="loadError" class="sw-message error kanban-error">{{ loadError }}</p>

        <div
          ref="kanbanBoard"
          class="kanban-board"
          @scroll="onBoardScroll">
          <p v-if="loading && !columns.length" class="sw-empty kanban-loading">Loading...</p>

          <div
            v-for="column in columns"
            :key="column.key"
            class="kanban-column">
            <div class="kanban-column-header">
              <span class="sw-label kanban-column-title">{{ column.label }}</span>
              <span class="kanban-column-count">{{ column.transactions.length }}</span>
            </div>
            <MonthColumnChart
              embedded
              :transactions="column.transactions"
              :month-key="column.key"
              @expand="openColumnChart(column)"
              @select-category="(payload) => onColumnCategorySelect(column, payload)"
              @select-date="(payload) => onColumnDateSelect(column, payload)" />
            <div class="kanban-column-body">
              <TransactionList
                :transactions="column.transactions"
                empty-message="No transactions" />
            </div>
          </div>

          <div v-if="loadingMore" class="kanban-column kanban-column--status">
            <p class="sw-empty">Loading more...</p>
          </div>
          <div v-else-if="endMessage" class="kanban-column kanban-column--status">
            <p class="sw-empty sw-muted">{{ endMessage }}</p>
          </div>
        </div>
      </div>
      </div>
    </AppletShell>

    <ChartDetailModal
      :is-open="!!columnChartDetail"
      :title="columnChartTitle"
      :loading="false"
      :selection-label="columnSelectionLabel"
      :selection-meta="columnSelectionMeta"
      :transactions="columnDrilldownTransactions"
      :show-transactions="!!columnChartDetail?.selection"
      :empty-message="columnEmptyMessage"
      @close="closeColumnChart"
      @clear-selection="clearColumnSelection">
      <template #chart>
        <MonthColumnChart
          v-if="columnChartDetail"
          :key="`${columnChartDetail.monthKey}-${columnChartDetail.selection?.category || ''}-${columnChartDetail.selection?.date || ''}`"
          expanded
          :transactions="columnChartDetail.transactions"
          :month-key="columnChartDetail.monthKey"
          @select-category="(payload) => onColumnCategorySelect(columnChartDetail, payload)"
          @select-date="(payload) => onColumnDateSelect(columnChartDetail, payload)" />
      </template>
    </ChartDetailModal>
  </div>
</template>

<script>
import { AppletShell } from '../components/common'
import MonthColumnChart from '../components/transactions/MonthColumnChart.vue'
import TransactionList from '../components/transactions/TransactionList.vue'
import ChartDetailModal from '../components/charts/ChartDetailModal.vue'
import { monzoApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import { monthFeedToColumn } from '../utils/transactions.js'
import { spendableTransactions } from '../utils/transactionAnalytics.js'
import { drilldownTransactions, selectionSummary } from '../composables/useTransactionDrilldown.js'

const HORIZONTAL_LOAD_THRESHOLD = 200
const MAX_PREFETCH_ATTEMPTS = 12

export default {
  name: 'TransactionsKanbanView',
  components: { AppletShell, MonthColumnChart, TransactionList, ChartDetailModal },
  data() {
    return {
      columns: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      nextMonth: null,
      endMessage: '',
      loadError: '',
      columnChartDetail: null,
      columnDrilldownTransactions: []
    }
  },
  computed: {
    columnChartTitle() {
      if (!this.columnChartDetail) return ''
      return `${this.columnChartDetail.label} overview`
    },
    columnSelectionLabel() {
      return this.columnChartDetail?.selection?.label || ''
    },
    columnSelectionMeta() {
      if (!this.columnDrilldownTransactions.length) return ''
      const summary = selectionSummary(this.columnDrilldownTransactions)
      const parts = [`${summary.count} transactions`]
      if (summary.spend > 0) parts.push(`spend ${formatMoney(summary.spend)}`)
      if (summary.income > 0) parts.push(`income ${formatMoney(summary.income)}`)
      return parts.join(' · ')
    },
    columnEmptyMessage() {
      const sel = this.columnChartDetail?.selection
      if (!sel) return 'No transactions'
      if (sel.date) return `No transactions on ${sel.label}`
      if (sel.label) return `No ${sel.label} transactions this month`
      return 'No transactions'
    }
  },
  mounted() {
    this.loadInitial()
  },
  methods: {
    formatMoney,
    applyMonthFeed(data, { append = false } = {}) {
      const column = monthFeedToColumn(data)

      if (append) {
        const seen = new Set(this.columns.map((c) => c.key))
        if (!seen.has(column.key)) {
          this.columns.push(column)
        }
      } else {
        this.columns = [column]
      }

      this.hasMore = Boolean(data.hasMore)
      this.nextMonth = data.nextMonth || null

      if (data.verificationRequired && data.message) {
        this.endMessage = data.message
        this.hasMore = false
        this.nextMonth = null
      }
    },
    getBoardElement() {
      return this.$refs.kanbanBoard
    },
    isBoardHorizontallyScrollable() {
      const el = this.getBoardElement()
      if (!el) return false
      return el.scrollWidth > el.clientWidth + 1
    },
    minColumnsToFillBoard() {
      const el = this.getBoardElement()
      if (!el) return 3
      const columnWidth = 300 + 12
      return Math.max(3, Math.ceil(el.clientWidth / columnWidth) + 1)
    },
    async prefetchMonthsIfNeeded() {
      let attempts = 0
      const targetColumns = this.minColumnsToFillBoard()
      while (
        this.hasMore &&
        this.nextMonth &&
        !this.loadingMore &&
        attempts < MAX_PREFETCH_ATTEMPTS &&
        (this.columns.length < targetColumns || !this.isBoardHorizontallyScrollable())
      ) {
        await this.$nextTick()
        if (this.columns.length >= targetColumns && this.isBoardHorizontallyScrollable()) break
        await this.loadMoreMonths()
        attempts++
      }
    },
    async loadInitial() {
      this.loading = true
      this.loadError = ''
      this.endMessage = ''
      this.hasMore = false
      this.nextMonth = null
      this.columns = []
      try {
        const { data } = await monzoApi.transactionMonth()
        this.applyMonthFeed(data)
      } catch (e) {
        this.columns = []
        this.loadError = e.response?.data?.error || e.message
      } finally {
        this.loading = false
      }
      await this.prefetchMonthsIfNeeded()
    },
    async loadMoreMonths() {
      if (this.loadingMore || !this.hasMore || !this.nextMonth) {
        return
      }
      this.loadingMore = true
      try {
        const { data } = await monzoApi.transactionMonth(this.nextMonth)
        this.applyMonthFeed(data, { append: true })
        if (!data.hasMore && !data.verificationRequired) {
          this.endMessage = this.endMessage || 'No more transactions.'
        }
      } catch (e) {
        this.hasMore = false
        this.endMessage = e.response?.data?.error || e.message
      } finally {
        this.loadingMore = false
        await this.prefetchMonthsIfNeeded()
      }
    },
    onBoardScroll() {
      const el = this.getBoardElement()
      if (!el) return
      const distanceFromRight = el.scrollWidth - el.clientWidth - el.scrollLeft
      if (distanceFromRight < HORIZONTAL_LOAD_THRESHOLD) {
        this.loadMoreMonths()
      }
    },
    openColumnChart(column) {
      this.columnChartDetail = {
        monthKey: column.key,
        label: column.label,
        transactions: column.transactions,
        selection: null
      }
      this.columnDrilldownTransactions = []
    },
    closeColumnChart() {
      this.columnChartDetail = null
      this.columnDrilldownTransactions = []
    },
    clearColumnSelection() {
      if (!this.columnChartDetail) return
      this.columnChartDetail = { ...this.columnChartDetail, selection: null }
      this.columnDrilldownTransactions = []
    },
    onColumnCategorySelect(column, payload) {
      if (!this.columnChartDetail || this.columnChartDetail.monthKey !== column.key) {
        this.columnChartDetail = {
          monthKey: column.key,
          label: column.label,
          transactions: column.transactions,
          selection: payload
        }
      } else {
        this.columnChartDetail = { ...this.columnChartDetail, selection: payload }
      }
      this.refreshColumnDrilldown()
    },
    onColumnDateSelect(column, payload) {
      if (!this.columnChartDetail || this.columnChartDetail.monthKey !== column.key) {
        this.columnChartDetail = {
          monthKey: column.key,
          label: column.label,
          transactions: column.transactions,
          selection: payload
        }
      } else {
        this.columnChartDetail = { ...this.columnChartDetail, selection: payload }
      }
      this.refreshColumnDrilldown()
    },
    refreshColumnDrilldown() {
      const sel = this.columnChartDetail?.selection
      if (!sel || !this.columnChartDetail) {
        this.columnDrilldownTransactions = []
        return
      }
      const base = spendableTransactions(this.columnChartDetail.transactions)
      this.columnDrilldownTransactions = drilldownTransactions({
        transactions: base,
        category: sel.category,
        date: sel.date
      })
    }
  }
}
</script>

<style scoped>
.transactions-kanban-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kanban-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kanban-header {
  flex-shrink: 0;
  margin-bottom: 1rem;
}

.kanban-hint {
  margin: 0;
  font-size: 0.75rem;
}

.kanban-error {
  flex-shrink: 0;
  margin: 0 0 0.75rem;
}

.kanban-board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.5rem;
}

.kanban-loading {
  align-self: center;
  margin: auto;
}

.kanban-column {
  flex-shrink: 0;
  width: 300px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #1e1e2e80;
  border: none;
  border-radius: var(--sw-chrome-radius-inner, 8px);
  overflow: hidden;
}

.kanban-column--status {
  width: 200px;
  justify-content: center;
  align-items: center;
  background: transparent;
  border: none;
}

.kanban-column-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem 0.5rem;
}

.kanban-column-title {
  color: var(--sw-text-secondary);
}

.kanban-column-count {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--sw-text-muted);
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--sw-tab-active-bg);
}

.kanban-column-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 0.65rem 0.5rem;
}
</style>
