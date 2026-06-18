<template>
  <BaseModal
    :is-open="isOpen"
    :title="title"
    class="modal-wide modal-chart"
    @close="$emit('close')">
    <div class="chart-detail-modal">
      <div class="chart-detail-modal__chart">
        <slot name="chart" />
      </div>

      <div v-if="selectionLabel" class="chart-detail-modal__selection">
        <div class="chart-detail-modal__selection-info">
          <span class="chart-detail-modal__selection-label">{{ selectionLabel }}</span>
          <span v-if="selectionMeta" class="chart-detail-modal__selection-meta">{{ selectionMeta }}</span>
        </div>
        <button type="button" class="chart-detail-modal__clear" @click="$emit('clear-selection')">
          Clear selection
        </button>
      </div>

      <div v-if="showTransactions" class="chart-detail-modal__transactions">
        <h3 class="chart-detail-modal__transactions-title">Transactions</h3>
        <TransactionList
          :transactions="transactions"
          :loading="loading"
          :empty-message="emptyMessage"
          selectable
          @select="$emit('select-transaction', $event)" />
      </div>
    </div>
  </BaseModal>
</template>

<script>
import { BaseModal } from '../common'
import TransactionList from '../transactions/TransactionList.vue'

export default {
  name: 'ChartDetailModal',
  components: { BaseModal, TransactionList },
  props: {
    isOpen: { type: Boolean, default: false },
    title: { type: String, required: true },
    loading: { type: Boolean, default: false },
    selectionLabel: { type: String, default: '' },
    selectionMeta: { type: String, default: '' },
    transactions: { type: Array, default: () => [] },
    showTransactions: { type: Boolean, default: false },
    emptyMessage: { type: String, default: 'No transactions' }
  },
  emits: ['close', 'clear-selection', 'select-transaction']
}
</script>

<style scoped>
.chart-detail-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-detail-modal__chart {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  contain: layout;
}

.chart-detail-modal__selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: var(--sw-panel-inset);
  border-radius: 8px;
}

.chart-detail-modal__selection-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.chart-detail-modal__selection-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--sw-text-primary);
  text-transform: capitalize;
}

.chart-detail-modal__selection-meta {
  font-size: 0.78rem;
  color: var(--sw-text-secondary);
}

.chart-detail-modal__clear {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--sw-blue-bright);
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.chart-detail-modal__clear:hover {
  text-decoration: underline;
}

.chart-detail-modal__transactions-title {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
}

.chart-detail-modal__transactions {
  max-height: 280px;
  overflow-y: auto;
  border-top: 1px solid var(--sw-border);
  padding-top: 0.75rem;
}
</style>
