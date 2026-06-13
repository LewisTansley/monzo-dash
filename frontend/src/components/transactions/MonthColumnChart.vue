<template>
  <div
    class="month-column-chart"
    :class="{
      'month-column-chart--expanded': expanded,
      'month-column-chart--embedded': embedded
    }">
    <template v-if="embedded">
      <ChartPanelShell hide-title @expand="$emit('expand')">
        <MonthChartBody
          embedded
          :transactions="transactions"
          :month-key="monthKey"
          :expanded="false"
          @select-category="$emit('select-category', $event)"
          @select-date="$emit('select-date', $event)" />
      </ChartPanelShell>
    </template>
    <template v-else-if="!expanded">
      <ChartPanelShell @expand="$emit('expand')">
        <template #title>
          <span class="month-column-chart__shell-title">Month overview</span>
        </template>
        <MonthChartBody
          :transactions="transactions"
          :month-key="monthKey"
          :expanded="false"
          @select-category="$emit('select-category', $event)"
          @select-date="$emit('select-date', $event)" />
      </ChartPanelShell>
    </template>
    <div v-else class="month-column-chart__content month-column-chart__content--expanded">
      <MonthChartBody
        :transactions="transactions"
        :month-key="monthKey"
        :expanded="true"
        @select-category="$emit('select-category', $event)"
        @select-date="$emit('select-date', $event)" />
    </div>
  </div>
</template>

<script>
import ChartPanelShell from '../charts/ChartPanelShell.vue'
import MonthChartBody from './MonthChartBody.vue'

export default {
  name: 'MonthColumnChart',
  components: { ChartPanelShell, MonthChartBody },
  props: {
    transactions: { type: Array, default: () => [] },
    monthKey: { type: String, required: true },
    embedded: { type: Boolean, default: false },
    expanded: { type: Boolean, default: false },
    selectedCategory: { type: String, default: null },
    selectedDate: { type: String, default: null }
  },
  emits: ['expand', 'select-category', 'select-date']
}
</script>

<style scoped>
.month-column-chart--embedded {
  flex-shrink: 0;
}

.month-column-chart--embedded :deep(.chart-panel-shell.panel) {
  padding: 0.35rem 0 0.5rem;
  border: none;
  background: transparent;
  border-radius: 0;
}

.month-column-chart--embedded :deep(.chart-panel-shell__header) {
  margin-bottom: 0.5rem;
  padding: 0 0.85rem;
}

.month-column-chart--embedded :deep(.chart-panel-shell__body) {
  padding: 0.6rem 0.75rem 0.75rem;
  background: var(--sw-sidebar-stack-overlay);
  border: none;
}

.month-column-chart--embedded :deep(.chart-panel-shell__header--bare) {
  margin-bottom: 0.35rem;
  justify-content: flex-end;
}

.month-column-chart__shell-title {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
}

.month-column-chart :deep(.chart-panel-shell__header) {
  margin-bottom: 0.35rem;
}

.month-column-chart :deep(.chart-panel-shell__expand) {
  width: 24px;
  height: 24px;
}

.month-column-chart:not(.month-column-chart--embedded) :deep(.chart-panel-shell__body) {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.65rem 0.6rem;
  border-bottom: 1px solid var(--sw-border);
  background: var(--sw-panel-inset);
}

.month-column-chart__content--expanded {
  padding: 0;
}
</style>
