<template>
  <div class="transaction-list">
    <p v-if="loading" class="sw-empty">Loading transactions...</p>
    <p v-else-if="!transactions.length" class="sw-empty">{{ emptyMessage }}</p>
    <template v-else>
      <div
        v-for="tx in transactions"
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
    emptyMessage: { type: String, default: 'No transactions' }
  },
  methods: {
    formatMoney,
    formatCategory,
    formatDay
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
