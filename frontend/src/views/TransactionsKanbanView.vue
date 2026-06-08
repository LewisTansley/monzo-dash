<template>
  <div class="transactions-kanban-view">
    <AppletShell variant="bare">
      <div class="kanban-shell">
        <header class="kanban-header">
          <h1>Transactions</h1>
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
              <span class="kanban-column-title">{{ column.label }}</span>
              <span class="kanban-column-count">{{ column.transactions.length }}</span>
            </div>
            <MonthColumnChart
              :transactions="column.transactions"
              :month-key="column.key" />
            <div class="kanban-column-body">
              <div
                v-for="tx in column.transactions"
                :key="tx.id"
                class="sw-list-row tx-row">
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
              <p v-if="!column.transactions.length" class="sw-empty tx-month-empty">No transactions</p>
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
    </AppletShell>
  </div>
</template>

<script>
import { AppletShell } from '../components/common'
import MonthColumnChart from '../components/transactions/MonthColumnChart.vue'
import { monzoApi } from '../services/api.js'
import { formatMoney } from '../utils/money.js'
import { formatCategory, formatDay, monthFeedToColumn } from '../utils/transactions.js'

const HORIZONTAL_LOAD_THRESHOLD = 200
const MAX_PREFETCH_ATTEMPTS = 12

export default {
  name: 'TransactionsKanbanView',
  components: { AppletShell, MonthColumnChart },
  data() {
    return {
      columns: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      nextMonth: null,
      endMessage: '',
      loadError: ''
    }
  },
  mounted() {
    this.loadInitial()
  },
  methods: {
    formatMoney,
    formatCategory,
    formatDay,
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
  padding: var(--sw-applet-padding, 1rem);
  background: var(--sw-space);
}

.kanban-header {
  flex-shrink: 0;
  margin-bottom: 1rem;
}

.kanban-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--sw-text-primary);
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
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
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
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--sw-border);
  background: var(--sw-panel-raised);
}

.kanban-column-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-secondary);
}

.kanban-column-count {
  font-size: 0.7rem;
  color: var(--sw-text-muted);
}

.kanban-column-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.35rem 0;
}

.tx-month-empty {
  margin: 0.5rem 0.85rem;
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

.tx-amount.credit {
  color: var(--sw-success);
}

.tx-meta {
  font-size: 0.72rem;
  color: var(--sw-text-muted);
  text-transform: capitalize;
}
</style>
