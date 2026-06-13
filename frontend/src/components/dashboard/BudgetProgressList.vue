<template>
  <div
    class="budget-progress"
    :class="{
      panel: !embedded,
      'budget-progress--expanded': expanded
    }">
    <div v-if="!hideTitle || showToolbar" class="budget-progress__header">
      <h2 v-if="!hideTitle" class="budget-progress__title">{{ title }}</h2>
      <div v-if="showToolbar" class="budget-progress__toolbar">
        <BaseButton
          v-if="vault.unlocked && !editing"
          variant="secondary"
          text="Edit budgets"
          @click="startEditing" />
        <BaseButton
          v-if="editing"
          variant="secondary"
          text="Cancel"
          @click="cancelEditing" />
      </div>
    </div>

    <p v-if="saveMessage" class="budget-progress__message success">{{ saveMessage }}</p>
    <p v-if="saveError" class="budget-progress__message error">{{ saveError }}</p>

    <template v-if="editing">
      <p class="budget-progress__hint">Monthly limits in pounds. Used for budget projections.</p>
      <div class="budget-progress__edit-list">
        <div v-for="cat in budgetCategories" :key="cat" class="budget-progress__edit-row">
          <span class="budget-progress__edit-label">{{ formatCategory(cat) }}</span>
          <div class="budget-progress__input-wrap">
            <span class="budget-progress__input-prefix" aria-hidden="true">£</span>
            <input
              v-model="budgetInputs[cat]"
              class="budget-progress__input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              inputmode="decimal"
              @click.stop />
          </div>
        </div>
      </div>
      <div class="budget-progress__form-actions">
        <BaseButton :disabled="saving" @click="saveBudgets">
          {{ saving ? 'Saving…' : 'Save budgets' }}
        </BaseButton>
      </div>
    </template>

    <template v-else>
      <div v-if="rows.length" class="budget-progress__list">
        <div
          v-for="row in displayRows"
          :key="row.category"
          class="budget-progress__row"
          :class="{ active: selectedCategory === row.category }"
          role="button"
          tabindex="0"
          :aria-label="`View ${formatCategory(row.category)} transactions`"
          @click="onRowClick(row.category)"
          @keydown.enter.prevent="onRowClick(row.category)"
          @keydown.space.prevent="onRowClick(row.category)">
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
          v-for="cat in displayFallbackCategories"
          :key="cat.category"
          class="budget-progress__row"
          :class="{ active: selectedCategory === cat.category }"
          role="button"
          tabindex="0"
          :aria-label="`View ${formatCategory(cat.category)} transactions`"
          @click="onRowClick(cat.category)"
          @keydown.enter.prevent="onRowClick(cat.category)"
          @keydown.space.prevent="onRowClick(cat.category)">
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
      <div v-else class="budget-progress__empty">
        <p class="muted">Set monthly limits to track spending.</p>
        <BaseButton
          v-if="vault.unlocked"
          variant="secondary"
          text="Set budgets"
          @click="startEditing" />
      </div>
    </template>
  </div>
</template>

<script>
import { BaseButton } from '../common'
import { useVaultStore } from '../../stores/vault.js'
import { budgetsApi } from '../../services/api.js'
import { formatMoney, parsePoundsToMinor } from '../../utils/money.js'
import { BUDGET_CATEGORIES } from '../../constants/budgetCategories.js'

const FALLBACK_LIMIT = 6

export default {
  name: 'BudgetProgressList',
  components: { BaseButton },
  props: {
    budgetStatus: { type: Object, default: () => ({}) },
    byCategory: { type: Object, default: () => ({}) },
    title: { type: String, default: 'Spending categories' },
    expanded: { type: Boolean, default: false },
    hideTitle: { type: Boolean, default: false },
    embedded: { type: Boolean, default: false },
    selectedCategory: { type: String, default: null }
  },
  emits: ['select-category', 'saved'],
  data() {
    return {
      editing: false,
      budgetCategories: BUDGET_CATEGORIES,
      budgetInputs: {},
      saving: false,
      saveMessage: '',
      saveError: ''
    }
  },
  computed: {
    vault() {
      return useVaultStore()
    },
    showToolbar() {
      return this.vault.unlocked || this.editing
    },
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
        .slice(0, FALLBACK_LIMIT)
        .map(([category, v]) => ({ category, spend: v.spend }))
    },
    displayRows() {
      return this.rows
    },
    displayFallbackCategories() {
      if (this.expanded) {
        return Object.entries(this.byCategory || {})
          .filter(([, v]) => v.spend > 0)
          .sort((a, b) => b[1].spend - a[1].spend)
          .map(([category, v]) => ({ category, spend: v.spend }))
      }
      return this.fallbackCategories
    },
    maxFallbackSpend() {
      const cats = this.displayFallbackCategories
      return Math.max(...cats.map((c) => c.spend), 1)
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
    },
    onRowClick(category) {
      this.$emit('select-category', {
        category,
        label: this.formatCategory(category)
      })
    },
    async startEditing() {
      this.saveMessage = ''
      this.saveError = ''
      try {
        await this.loadBudgets()
        this.editing = true
      } catch (e) {
        this.saveError = e.response?.data?.error || e.message
      }
    },
    cancelEditing() {
      this.editing = false
      this.saveError = ''
    },
    async loadBudgets() {
      const { data } = await budgetsApi.get()
      const inputs = {}
      for (const cat of BUDGET_CATEGORIES) {
        const minor = data.budgets?.[cat]
        inputs[cat] = minor ? (minor / 100).toFixed(2) : ''
      }
      this.budgetInputs = inputs
    },
    async saveBudgets() {
      this.saving = true
      this.saveMessage = ''
      this.saveError = ''
      try {
        const budgets = {}
        for (const cat of BUDGET_CATEGORIES) {
          const val = this.budgetInputs[cat]
          if (val !== '' && val != null) {
            budgets[cat] = parsePoundsToMinor(val)
          }
        }
        await budgetsApi.set(budgets)
        this.editing = false
        this.saveMessage = 'Budgets saved.'
        this.$emit('saved')
        setTimeout(() => { this.saveMessage = '' }, 3000)
      } catch (e) {
        this.saveError = e.response?.data?.error || e.message
      } finally {
        this.saving = false
      }
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
}

.budget-progress.panel {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.budget-progress__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.budget-progress__header:has(.budget-progress__toolbar:only-child) {
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.budget-progress__title {
  margin: 0;
  font-size: 1rem;
}

.budget-progress__toolbar {
  flex-shrink: 0;
  margin-left: auto;
}

.budget-progress__hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--sw-text-secondary);
}

.budget-progress__edit-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.budget-progress__edit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 0.75rem;
  align-items: center;
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
}

.budget-progress__edit-label {
  text-transform: capitalize;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--sw-text-primary);
}

.budget-progress__input-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
  background: var(--sw-applet-segmented-bg);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-chrome-radius-inner);
  transition: border-color 0.15s ease, outline 0.15s ease;
}

.budget-progress__input-wrap:focus-within {
  border-color: var(--sw-blue-muted);
  outline: 2px solid rgba(var(--sw-blue-muted-rgb), 0.35);
  outline-offset: 0;
}

.budget-progress__input-prefix {
  flex-shrink: 0;
  padding-left: 0.65rem;
  font-size: 0.85rem;
  color: var(--sw-text-muted);
  user-select: none;
}

.budget-progress__input {
  width: 100%;
  min-width: 0;
  padding: 0.45rem 0.65rem 0.45rem 0.25rem;
  background: transparent;
  border: none;
  border-radius: var(--sw-chrome-radius-inner);
  color: var(--sw-text-primary);
  font-family: inherit;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  box-sizing: border-box;
}

.budget-progress__input::placeholder {
  color: var(--sw-text-muted);
}

.budget-progress__input:focus {
  outline: none;
}

.budget-progress__input::-webkit-outer-spin-button,
.budget-progress__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.budget-progress__input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.budget-progress__form-actions {
  margin-top: 0.85rem;
}

.budget-progress__message {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
}

.budget-progress__message.success { color: var(--sw-success); }
.budget-progress__message.error { color: var(--sw-warning); }

.budget-progress__list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.budget-progress__row {
  background: var(--sw-panel-inset);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.budget-progress__row:hover,
.budget-progress__row.active {
  border-color: var(--sw-border-strong);
  background: var(--sw-panel-raised);
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

.budget-progress__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.muted { color: var(--sw-text-muted); font-size: 0.85rem; }
</style>
