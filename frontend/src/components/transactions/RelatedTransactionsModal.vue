<template>
  <BaseModal
    :is-open="isOpen"
    :title="title"
    class="modal-wide"
    @close="$emit('close')">
    <div class="related-tx-modal">
      <div v-if="selectionLabel" class="related-tx-modal__selection">
        <div class="related-tx-modal__selection-info">
          <span class="related-tx-modal__selection-label">{{ selectionLabel }}</span>
          <span v-if="selectionMeta" class="related-tx-modal__selection-meta">{{ selectionMeta }}</span>
        </div>
      </div>

      <TransactionList
        :transactions="transactions"
        :loading="loading"
        :empty-message="emptyMessage"
        selectable
        :highlight-id="anchorTx?.id"
        @select="$emit('select', $event)" />
    </div>
  </BaseModal>
</template>

<script>
import { BaseModal } from '../common'
import TransactionList from './TransactionList.vue'

export default {
  name: 'RelatedTransactionsModal',
  components: { BaseModal, TransactionList },
  props: {
    isOpen: { type: Boolean, default: false },
    title: { type: String, default: 'Transactions' },
    loading: { type: Boolean, default: false },
    anchorTx: { type: Object, default: null },
    transactions: { type: Array, default: () => [] },
    selectionLabel: { type: String, default: '' },
    selectionMeta: { type: String, default: '' },
    emptyMessage: { type: String, default: 'No other transactions found' }
  },
  emits: ['close', 'select']
}
</script>

<style scoped>
.related-tx-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.related-tx-modal__selection {
  padding: 0.65rem 0.85rem;
  background: var(--sw-panel-inset);
  border-radius: 8px;
}

.related-tx-modal__selection-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.related-tx-modal__selection-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--sw-text-primary);
}

.related-tx-modal__selection-meta {
  font-size: 0.78rem;
  color: var(--sw-text-secondary);
}

.related-tx-modal :deep(.transaction-list) {
  max-height: 420px;
  overflow-y: auto;
}
</style>
