<template>
  <div class="chart-panel-shell panel" :class="{ 'chart-panel-shell--bare': hideTitle }">
    <div class="chart-panel-shell__header" :class="{ 'chart-panel-shell__header--bare': hideTitle }">
      <div v-if="!hideTitle" class="chart-panel-shell__title">
        <slot name="title" />
      </div>
      <button
        type="button"
        class="chart-panel-shell__expand"
        aria-label="Expand chart"
        @click="$emit('expand')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M9 2H14V7M7 14H2V9M14 2L10 6M2 14L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="chart-panel-shell__body">
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChartPanelShell',
  props: {
    hideTitle: { type: Boolean, default: false }
  },
  emits: ['expand']
}
</script>

<style scoped>
.chart-panel-shell.panel {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-sizing: border-box;
}

.chart-panel-shell {
  min-width: 0;
  max-width: 100%;
}

.chart-panel-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.chart-panel-shell__title {
  flex: 1;
  min-width: 0;
}

.chart-panel-shell__title :deep(h2),
.chart-panel-shell__title :deep(.metric-card__label),
.chart-panel-shell__title :deep(.budget-progress__title) {
  margin: 0;
}

.chart-panel-shell__expand {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--sw-text-muted);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.chart-panel-shell:hover .chart-panel-shell__expand,
.chart-panel-shell__expand:focus-visible {
  opacity: 1;
}

.chart-panel-shell__header--bare {
  margin-bottom: 0;
  justify-content: flex-end;
}

.chart-panel-shell--bare.panel {
  padding-top: 0.35rem;
  padding-bottom: 0.5rem;
}

.chart-panel-shell__expand:hover {
  background: var(--sw-tab-active-bg);
  border-color: transparent;
  color: var(--sw-text-primary);
}

.chart-panel-shell__body {
  min-width: 0;
}
</style>
