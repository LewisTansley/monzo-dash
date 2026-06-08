<template>
  <div class="budget-progress panel">
    <h2 class="budget-progress__title">{{ title }}</h2>
    <div v-if="rows.length" class="budget-progress__list">
      <div
        v-for="row in rows"
        :key="row.category"
        class="budget-progress__row">
        <div class="budget-progress__head">
          <span class="budget-progress__cat">{{ formatCategory(row.category) }}</span>
          <span class="budget-progress__amounts">
            {{ formatMoney(row.spent) }} of {{ formatMoney(row.budget) }}
          </span>
        </div>
        <div class="budget-progress__track">
          <div
            class="budget-progress__fill"
            :class="{ over: row.percentUsed > 100 }"
            :style="{ width: fillWidth(row.percentUsed) }" />
        </div>
        <span class="budget-progress__pct" :class="row.percentUsed > 100 ? 'over' : 'ok'">
          {{ row.percentUsed }}% used
        </span>
      </div>
    </div>
    <div v-else-if="fallbackCategories.length" class="budget-progress__list">
      <div
        v-for="cat in fallbackCategories"
        :key="cat.category"
        class="budget-progress__row">
        <div class="budget-progress__head">
          <span class="budget-progress__cat">{{ formatCategory(cat.category) }}</span>
          <span class="budget-progress__amounts">{{ formatMoney(cat.spend) }}</span>
        </div>
        <div class="budget-progress__track">
          <div
            class="budget-progress__fill fallback"
            :style="{ width: fallbackWidth(cat.spend) }" />
        </div>
      </div>
    </div>
    <p v-else class="muted">No budget or category data yet</p>
  </div>
</template>

<script>
import { formatMoney } from '../../utils/money.js'

export default {
  name: 'BudgetProgressList',
  props: {
    budgetStatus: { type: Object, default: () => ({}) },
    byCategory: { type: Object, default: () => ({}) },
    title: { type: String, default: 'Spending categories' }
  },
  computed: {
    rows() {
      return Object.entries(this.budgetStatus || {}).map(([category, data]) => ({
        category,
        ...data
      }))
    },
    fallbackCategories() {
      if (this.rows.length) return []
      return Object.entries(this.byCategory || {})
        .filter(([, v]) => v.spend > 0)
        .sort((a, b) => b[1].spend - a[1].spend)
        .slice(0, 6)
        .map(([category, v]) => ({ category, spend: v.spend }))
    },
    maxFallbackSpend() {
      return Math.max(...this.fallbackCategories.map((c) => c.spend), 1)
    }
  },
  methods: {
    formatMoney,
    formatCategory(cat) {
      return cat.replace(/_/g, ' ')
    },
    fillWidth(percent) {
      return `${Math.min(percent, 100)}%`
    },
    fallbackWidth(spend) {
      return `${Math.round((spend / this.maxFallbackSpend) * 100)}%`
    }
  }
}
</script>

<style scoped>
.budget-progress {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.budget-progress__title {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}

.budget-progress__list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.budget-progress__row {
  background: var(--sw-panel-inset);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
}

.budget-progress__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.budget-progress__cat {
  text-transform: capitalize;
  color: var(--sw-text-primary);
  font-weight: 500;
}

.budget-progress__amounts {
  color: var(--sw-text-secondary);
  font-size: 0.8rem;
  white-space: nowrap;
}

.budget-progress__track {
  height: 6px;
  background: var(--sw-border);
  border-radius: 3px;
  overflow: hidden;
}

.budget-progress__fill {
  height: 100%;
  background: var(--sw-blue-bright);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.budget-progress__fill.over {
  background: var(--sw-warning);
}

.budget-progress__fill.fallback {
  background: var(--sw-accent-orange);
}

.budget-progress__pct {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.75rem;
}

.budget-progress__pct.ok { color: var(--sw-success); }
.budget-progress__pct.over { color: var(--sw-warning); }

.muted { color: var(--sw-text-muted); font-size: 0.85rem; }
</style>
