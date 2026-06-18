<template>
  <div class="transaction-list">
    <p v-if="loading" class="sw-empty">Loading transactions...</p>
    <p v-else-if="!transactions.length" class="sw-empty">{{ emptyMessage }}</p>
    <template v-else>
      <div
        v-for="tx in transactions"
        :key="tx.id"
        class="sw-list-row tx-row"
        :class="rowClass(tx)"
        :role="selectable ? 'button' : undefined"
        :tabindex="selectable ? 0 : undefined"
        @click="onRowClick(tx)"
        @keydown.enter.prevent="onRowClick(tx)"
        @keydown.space.prevent="onRowClick(tx)">
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
    </template>
  </div>
</template>

<script>
import { formatMoney } from '../../utils/money.js'
import { formatCategory, formatDay } from '../../utils/transactions.js'

export default {
  name: 'TransactionList',
  props: {
    transactions: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyMessage: { type: String, default: 'No transactions' },
    selectable: { type: Boolean, default: false },
    selectedId: { type: String, default: null },
    highlightId: { type: String, default: null }
  },
  emits: ['select'],
  methods: {
    formatMoney,
    formatCategory,
    formatDay,
    rowClass(tx) {
      return {
        'tx-row--selectable': this.selectable,
        'tx-row--selected': this.selectable && this.selectedId === tx.id,
        'tx-row--highlight': this.highlightId === tx.id
      }
    },
    onRowClick(tx) {
      if (!this.selectable) return
      this.$emit('select', tx)
    }
  }
}
</script>

<style scoped>
.transaction-list {
  display: flex;
  flex-direction: column;
}

.tx-row {
  cursor: default;
  align-items: flex-start;
}

.tx-row--selectable {
  cursor: pointer;
}

.tx-row--selectable:hover {
  background: var(--sw-tab-active-bg);
}

.tx-row--highlight {
  background: var(--sw-tab-active-bg);
  outline: 1px solid var(--sw-blue-bright);
  outline-offset: -1px;
}

.tx-row--selected {
  background: var(--sw-panel-inset);
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
