<template>
  <div
    class="transaction-filter-bar"
    :class="{
      'transaction-filter-bar--disabled': disabled,
      'transaction-filter-bar--collapsed': !expanded
    }">
    <div class="filter-bar__toggle-row">
      <button
        type="button"
        class="filter-bar__expand"
        :aria-expanded="expanded"
        :disabled="disabled"
        @click="expanded = !expanded">
        <svg
          class="filter-bar__chevron"
          :class="{ 'filter-bar__chevron--expanded': expanded }"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
        <span>Filters</span>
      </button>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="filter-bar__clear"
        :disabled="disabled"
        @click="$emit('clear')">
        Clear all
      </button>
      <span class="filter-bar__summary sw-muted" aria-live="polite">
        {{ summaryText }}
      </span>
    </div>

    <div v-show="expanded" class="filter-bar__body">
      <div class="filter-bar__row filter-bar__row--primary">
        <input
          :value="modelValue.query"
          class="filter-bar__search"
          type="search"
          placeholder="Search descriptions…"
          :disabled="disabled"
          aria-label="Search transaction descriptions"
          @input="onQueryInput" />
      </div>

      <div class="filter-bar__group">
      <span class="sw-label filter-bar__label">Category</span>
      <div class="filter-bar__chips" role="group" aria-label="Spending categories">
        <button
          v-for="cat in displayCategories"
          :key="cat"
          type="button"
          class="filter-item"
          :class="{ active: isCategoryActive(cat) }"
          :aria-pressed="isCategoryActive(cat)"
          :disabled="disabled"
          @click="toggleCategory(cat)">
          {{ formatCategory(cat) }}
        </button>
      </div>
    </div>

    <div class="filter-bar__group">
      <span class="sw-label filter-bar__label">Payment type</span>
      <div class="filter-bar__chips" role="group" aria-label="Payment type">
        <button
          type="button"
          class="filter-item"
          :class="{ active: !modelValue.paymentTypes.length }"
          :aria-pressed="!modelValue.paymentTypes.length"
          :disabled="disabled"
          @click="setPaymentTypes([])">
          All
        </button>
        <button
          v-for="type in paymentTypeOptions"
          :key="type.id"
          type="button"
          class="filter-item"
          :class="{ active: isPaymentTypeActive(type.id) }"
          :aria-pressed="isPaymentTypeActive(type.id)"
          :disabled="disabled"
          @click="togglePaymentType(type.id)">
          {{ type.label }}
        </button>
      </div>
    </div>

    <div class="filter-bar__group filter-bar__group--inline">
      <span class="sw-label filter-bar__label">Flow</span>
      <div class="period-toggle" role="group" aria-label="Transaction flow">
        <button
          type="button"
          class="period-toggle__btn"
          :class="{ active: !modelValue.series }"
          :disabled="disabled"
          @click="setSeries(null)">
          All
        </button>
        <button
          type="button"
          class="period-toggle__btn"
          :class="{ active: modelValue.series === 'spend' }"
          :disabled="disabled"
          @click="setSeries('spend')">
          Spend
        </button>
        <button
          type="button"
          class="period-toggle__btn"
          :class="{ active: modelValue.series === 'income' }"
          :disabled="disabled"
          @click="setSeries('income')">
          Income
        </button>
      </div>
      <label class="filter-bar__toggle">
        <input
          type="checkbox"
          :checked="modelValue.hidePotTransfers"
          :disabled="disabled"
          @change="setHidePotTransfers($event.target.checked)" />
        <span>Hide pot transfers</span>
      </label>
    </div>

    <div v-if="recurringDescriptions.length" class="filter-bar__group">
      <span class="sw-label filter-bar__label">Recurring</span>
      <div class="filter-bar__chips" role="group" aria-label="Recurring transactions">
        <button
          v-for="entry in recurringDescriptions"
          :key="entry.description"
          type="button"
          class="filter-item"
          :class="{ active: isDescriptionActive(entry.description) }"
          :aria-pressed="isDescriptionActive(entry.description)"
          :disabled="disabled"
          :title="`${entry.count} occurrences`"
          @click="toggleDescription(entry.description)">
          {{ entry.label }}
          <span class="filter-item__count">{{ entry.count }}</span>
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { formatCategory } from '../../utils/transactions.js'
import {
  DEFAULT_KANBAN_FILTERS,
  isKanbanFiltersActive,
  MONZO_CATEGORIES
} from '../../utils/transactionFilters.js'

const PAYMENT_TYPE_OPTIONS = [
  { id: 'card', label: 'Card' },
  { id: 'direct_debit', label: 'Direct debit' },
  { id: 'transfer', label: 'Bank transfer' },
  { id: 'pot', label: 'Pot' },
  { id: 'topup', label: 'Top-up' },
  { id: 'cash', label: 'Cash' }
]

export default {
  name: 'TransactionFilterBar',
  props: {
    modelValue: {
      type: Object,
      default: () => ({ ...DEFAULT_KANBAN_FILTERS })
    },
    options: {
      type: Object,
      default: () => ({ categories: [], recurringDescriptions: [] })
    },
    matchSummary: {
      type: Object,
      default: () => ({ count: 0, monthCount: 0, searching: false })
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'clear'],
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    paymentTypeOptions() {
      return PAYMENT_TYPE_OPTIONS
    },
    displayCategories() {
      const fromData = this.options.categories || []
      const merged = new Set([...MONZO_CATEGORIES, ...fromData])
      return [...merged].sort()
    },
    recurringDescriptions() {
      return this.options.recurringDescriptions || []
    },
    hasActiveFilters() {
      return isKanbanFiltersActive(this.modelValue)
    },
    summaryText() {
      const { count, monthCount, searching } = this.matchSummary
      if (searching) {
        return `Searching older months… (${monthCount} loaded)`
      }
      if (!this.hasActiveFilters) {
        return 'No filters active'
      }
      if (!count) {
        return 'No matches'
      }
      const monthLabel = monthCount === 1 ? 'month' : 'months'
      return `${count} match${count === 1 ? '' : 'es'} · ${monthCount} ${monthLabel}`
    }
  },
  methods: {
    formatCategory,
    emitUpdate(patch) {
      this.$emit('update:modelValue', { ...this.modelValue, ...patch })
    },
    onQueryInput(event) {
      this.emitUpdate({ query: event.target.value })
    },
    isCategoryActive(cat) {
      return (this.modelValue.categories || []).includes(cat)
    },
    toggleCategory(cat) {
      const current = [...(this.modelValue.categories || [])]
      const idx = current.indexOf(cat)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(cat)
      this.emitUpdate({ categories: current })
    },
    isPaymentTypeActive(type) {
      return (this.modelValue.paymentTypes || []).includes(type)
    },
    setPaymentTypes(types) {
      this.emitUpdate({ paymentTypes: types })
    },
    togglePaymentType(type) {
      const current = [...(this.modelValue.paymentTypes || [])]
      const idx = current.indexOf(type)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(type)
      this.emitUpdate({ paymentTypes: current })
    },
    setSeries(series) {
      this.emitUpdate({ series })
    },
    setHidePotTransfers(hidePotTransfers) {
      this.emitUpdate({ hidePotTransfers })
    },
    isDescriptionActive(description) {
      return (this.modelValue.descriptions || []).includes(description)
    },
    toggleDescription(description) {
      const current = [...(this.modelValue.descriptions || [])]
      const idx = current.indexOf(description)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(description)
      this.emitUpdate({ descriptions: current })
    }
  }
}
</script>

<style scoped>
.transaction-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
  background: var(--sw-applet-segmented-bg);
  border-radius: var(--sw-chrome-radius-inner);
}

.transaction-filter-bar--collapsed {
  gap: 0;
  padding: 0.45rem 0.65rem;
}

.transaction-filter-bar--disabled {
  opacity: 0.7;
  pointer-events: none;
}

.filter-bar__toggle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.filter-bar__expand {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0.25rem 0.4rem 0.25rem 0.25rem;
  border: none;
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  background: transparent;
  color: var(--sw-text-secondary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}

.filter-bar__expand:hover {
  color: var(--sw-text-primary);
  background: rgba(var(--sw-blue-muted-rgb), 0.12);
}

.filter-bar__chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.filter-bar__chevron--expanded {
  transform: rotate(180deg);
}

.filter-bar__body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.filter-bar__row--primary {
  gap: 0.65rem;
}

.filter-bar__search {
  flex: 1;
  min-width: 10rem;
  padding: 0.45rem 0.65rem;
  border: none;
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  background: var(--sw-panel-inset);
  color: var(--sw-text-primary);
  font: inherit;
  font-size: 0.85rem;
}

.filter-bar__search::placeholder {
  color: var(--sw-text-muted);
}

.filter-bar__search:focus-visible {
  outline: 2px solid var(--sw-border-strong);
  outline-offset: 1px;
}

.filter-bar__clear {
  margin: 0;
  padding: 0.4rem 0.7rem;
  border: none;
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  background: transparent;
  color: var(--sw-text-secondary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}

.filter-bar__clear:hover {
  color: var(--sw-text-primary);
  background: rgba(var(--sw-blue-muted-rgb), 0.12);
}

.filter-bar__summary {
  margin-left: auto;
  font-size: 0.72rem;
  white-space: nowrap;
}

.filter-bar__group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.filter-bar__group--inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
}

.filter-bar__label {
  flex-shrink: 0;
}

.filter-bar__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.1rem;
  scrollbar-width: thin;
}

.filter-item {
  flex-shrink: 0;
  margin: 0;
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  background: var(--sw-panel-inset);
  color: var(--sw-text-secondary);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.filter-item:hover {
  color: var(--sw-text-primary);
}

.filter-item.active {
  background: #f1f1f110;
  color: var(--sw-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.filter-item__count {
  margin-left: 0.35rem;
  color: var(--sw-text-muted);
  font-size: 0.65rem;
}

.filter-item.active .filter-item__count {
  color: var(--sw-text-secondary);
}

.period-toggle {
  display: inline-flex;
  background: var(--sw-panel-inset);
  border-radius: calc(var(--sw-chrome-radius-inner) - 2px);
  padding: 2px;
}

.period-toggle__btn {
  background: transparent;
  border: none;
  color: var(--sw-text-muted);
  padding: 0.3rem 0.65rem;
  border-radius: calc(var(--sw-chrome-radius-inner) - 4px);
  cursor: pointer;
  font-size: 0.72rem;
  font-family: inherit;
  font-weight: 500;
}

.period-toggle__btn:hover {
  color: var(--sw-text-primary);
}

.period-toggle__btn.active {
  background: #f1f1f110;
  color: var(--sw-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.filter-bar__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: var(--sw-text-secondary);
  cursor: pointer;
  user-select: none;
}

.filter-bar__toggle input {
  accent-color: var(--sw-blue-muted);
}
</style>
