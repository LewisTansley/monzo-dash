<template>
  <div class="budget-view">
    <AppletShell variant="bare">
      <div class="applet-center applet-center--page">
        <div class="applet-center-inner">
    <header class="page-header">
      <div>
        <p class="muted page-header__subtitle">Model estimated income and outgoings to see what you can afford — separate from your Monzo spending limits in Settings.</p>
      </div>
      <BaseButton text="Add item" @click="openCreate" />
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="muted">Loading...</div>

    <template v-else>
      <div v-if="summary" class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Monthly income</span>
          <span class="stat-value positive">{{ formatMoney(summary.monthlyIncome) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Monthly outgoings</span>
          <span class="stat-value">{{ formatMoney(summary.monthlyExpenses) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Monthly leftover</span>
          <span class="stat-value" :class="summary.isSurplus ? 'positive' : 'negative'">
            {{ formatMoney(summary.monthlyNet) }}
          </span>
        </div>
      </div>

      <p v-if="summary" class="callout" :class="summary.isSurplus ? 'surplus' : 'deficit'">
        <template v-if="summary.isSurplus">
          {{ formatMoney(summary.monthlyNet) }} left over per month based on these estimates.
        </template>
        <template v-else>
          You are {{ formatMoney(Math.abs(summary.monthlyNet)) }} under per month based on these estimates.
        </template>
      </p>

      <div v-if="summary" class="annual-row panel">
        <span>Annual income: <strong>{{ formatMoney(summary.annualIncome) }}</strong></span>
        <span>Annual outgoings: <strong>{{ formatMoney(summary.annualExpenses) }}</strong></span>
        <span>
          Annual net:
          <strong :class="summary.annualNet >= 0 ? 'positive' : 'negative'">
            {{ formatMoney(summary.annualNet) }}
          </strong>
        </span>
        <span v-if="summary.monthlyIncome > 0" class="muted">
          Savings rate: {{ summary.savingsRate }}%
        </span>
      </div>

      <div v-if="!items.length" class="empty panel">
        <p>Add your first income or expense to check affordability.</p>
      </div>

      <template v-else>
        <section v-if="incomeItems.length" class="panel">
          <h2>Income</h2>
          <div class="item-table ledger-table">
            <div class="item-row item-head">
              <span>Name</span>
              <span>Category</span>
              <span>Frequency</span>
              <span>Amount</span>
              <span>Monthly eq.</span>
              <span></span>
            </div>
            <div v-for="item in incomeItems" :key="item.id" class="item-row">
              <span class="item-name">{{ item.name }}</span>
              <span class="muted">{{ formatCategory(item.category) }}</span>
              <span class="muted">{{ formatFrequency(item.frequency) }}</span>
              <span>{{ formatMoney(item.amount) }}</span>
              <span class="muted">
                {{ item.frequency === 'one-off' ? '—' : formatMoney(item.monthlyEquivalent) }}
              </span>
              <span class="item-actions">
                <BaseButton variant="secondary" text="Edit" @click="openEdit(item)" />
                <BaseButton variant="danger" text="Delete" @click="remove(item.id)" />
              </span>
            </div>
          </div>
        </section>

        <section v-if="expenseItems.length" class="panel">
          <h2>Outgoings</h2>
          <div class="item-table ledger-table">
            <div class="item-row item-head">
              <span>Name</span>
              <span>Category</span>
              <span>Frequency</span>
              <span>Amount</span>
              <span>Monthly eq.</span>
              <span></span>
            </div>
            <div v-for="item in expenseItems" :key="item.id" class="item-row">
              <span class="item-name">{{ item.name }}</span>
              <span class="muted">{{ formatCategory(item.category) }}</span>
              <span class="muted">{{ formatFrequency(item.frequency) }}</span>
              <span>{{ formatMoney(item.amount) }}</span>
              <span class="muted">
                {{ item.frequency === 'one-off' ? '—' : formatMoney(item.monthlyEquivalent) }}
              </span>
              <span class="item-actions">
                <BaseButton variant="secondary" text="Edit" @click="openEdit(item)" />
                <BaseButton variant="danger" text="Delete" @click="remove(item.id)" />
              </span>
            </div>
          </div>
        </section>

        <section v-if="categoryRows.length" class="panel">
          <h2>By category</h2>
          <div class="item-table category-table">
            <div class="item-row item-head">
              <span>Category</span>
              <span>Monthly in</span>
              <span>Monthly out</span>
              <span>Annual in</span>
              <span>Annual out</span>
            </div>
            <div v-for="row in categoryRows" :key="row.category" class="item-row">
              <span>{{ formatCategory(row.category) }}</span>
              <span class="positive">{{ formatMoney(row.monthlyIncome) }}</span>
              <span>{{ formatMoney(row.monthlyExpenses) }}</span>
              <span class="positive">{{ formatMoney(row.annualIncome) }}</span>
              <span>{{ formatMoney(row.annualExpenses) }}</span>
            </div>
          </div>
        </section>
      </template>
    </template>
        </div>
      </div>
    </AppletShell>

    <BaseModal
      :is-open="modalOpen"
      :title="editingId ? 'Edit item' : 'Add item'"
      @close="closeModal">
      <form class="item-form" @submit.prevent="saveItem">
        <div class="quick-add">
          <span class="muted">Quick add:</span>
          <button
            v-for="preset in presets"
            :key="preset.name"
            type="button"
            class="chip"
            @click="applyPreset(preset)">
            {{ preset.name }}
          </button>
        </div>

        <label>
          Name
          <input v-model="form.name" type="text" required />
        </label>

        <label>
          Type
          <select v-model="form.type">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label>
          Amount (£)
          <input v-model="form.amount" type="number" min="0.01" step="0.01" required />
        </label>

        <label>
          Frequency
          <select v-model="form.frequency">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="one-off">One-off</option>
          </select>
        </label>

        <label>
          Category
          <select v-model="form.category">
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ formatCategory(cat) }}
            </option>
          </select>
        </label>

        <p v-if="formError" class="form-error">{{ formError }}</p>
      </form>

      <template #footer>
        <BaseButton variant="secondary" text="Cancel" @click="closeModal" />
        <BaseButton text="Save" :disabled="saving" @click="saveItem" />
      </template>
    </BaseModal>
  </div>
</template>

<script>
import { AppletShell, BaseButton, BaseModal } from '../components/common'
import { budgetApi } from '../services/api.js'
import { formatMoney, parsePoundsToMinor, minorToPoundsInput } from '../utils/money.js'
import { useDataStatusStore } from '../stores/dataStatus.js'

const CATEGORIES = [
  'income', 'housing', 'utilities', 'insurance', 'transport',
  'food', 'lifestyle', 'savings', 'other'
]

const PRESETS = [
  { name: 'Rent', type: 'expense', frequency: 'monthly', category: 'housing' },
  { name: 'Salary', type: 'income', frequency: 'monthly', category: 'income' },
  { name: 'Subscriptions', type: 'expense', frequency: 'monthly', category: 'lifestyle' },
  { name: 'Groceries', type: 'expense', frequency: 'monthly', category: 'food' },
  { name: 'Council tax', type: 'expense', frequency: 'annual', category: 'housing' }
]

function emptyForm() {
  return {
    name: '',
    type: 'expense',
    amount: '',
    frequency: 'monthly',
    category: 'other'
  }
}

export default {
  name: 'BudgetView',
  components: { AppletShell, BaseButton, BaseModal },
  data() {
    return {
      items: [],
      summary: null,
      loading: false,
      error: '',
      modalOpen: false,
      editingId: null,
      form: emptyForm(),
      formError: '',
      saving: false,
      categories: CATEGORIES,
      presets: PRESETS
    }
  },
  computed: {
    dataStatus() {
      return useDataStatusStore()
    },
    incomeItems() {
      return this.items.filter((i) => i.type === 'income')
    },
    expenseItems() {
      return this.items.filter((i) => i.type === 'expense')
    },
    categoryRows() {
      if (!this.summary?.byCategory) return []
      return Object.values(this.summary.byCategory)
        .filter((r) => r.monthlyIncome || r.monthlyExpenses || r.annualIncome || r.annualExpenses)
        .sort((a, b) => a.category.localeCompare(b.category))
    }
  },
  watch: {
    'dataStatus.refreshGeneration'() {
      if (this.dataStatus.refreshing) {
        this.handleAppRefresh()
      }
    }
  },
  mounted() {
    this.load()
  },
  methods: {
    formatMoney,
    formatCategory(cat) {
      return (cat || 'other').replace(/_/g, ' ')
    },
    formatFrequency(freq) {
      if (freq === 'one-off') return 'One-off'
      return freq.charAt(0).toUpperCase() + freq.slice(1)
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        const { data } = await budgetApi.get()
        this.items = data.items || []
        this.summary = data.summary || null
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.loading = false
      }
    },
    async handleAppRefresh() {
      try {
        await this.load()
      } finally {
        this.dataStatus.finishRefresh()
      }
    },
    openCreate() {
      this.editingId = null
      this.form = emptyForm()
      this.formError = ''
      this.modalOpen = true
    },
    openEdit(item) {
      this.editingId = item.id
      this.form = {
        name: item.name,
        type: item.type,
        amount: minorToPoundsInput(item.amount),
        frequency: item.frequency,
        category: item.category || 'other'
      }
      this.formError = ''
      this.modalOpen = true
    },
    closeModal() {
      this.modalOpen = false
      this.editingId = null
      this.formError = ''
    },
    applyPreset(preset) {
      this.form = {
        name: preset.name,
        type: preset.type,
        amount: '',
        frequency: preset.frequency,
        category: preset.category
      }
    },
    async saveItem() {
      this.formError = ''
      const amount = parsePoundsToMinor(this.form.amount)
      if (amount <= 0) {
        this.formError = 'Amount must be greater than zero'
        return
      }
      const payload = {
        name: this.form.name.trim(),
        type: this.form.type,
        amount,
        frequency: this.form.frequency,
        category: this.form.category
      }
      this.saving = true
      try {
        const { data } = this.editingId
          ? await budgetApi.updateItem(this.editingId, payload)
          : await budgetApi.createItem(payload)
        this.items = data.items || []
        this.summary = data.summary || null
        this.closeModal()
      } catch (e) {
        this.formError = e.response?.data?.error || e.message
      } finally {
        this.saving = false
      }
    },
    async remove(id) {
      if (!confirm('Delete this item?')) return
      try {
        const { data } = await budgetApi.deleteItem(id)
        this.items = data.items || []
        this.summary = data.summary || null
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      }
    }
  }
}
</script>

<style scoped>
.budget-view {
  height: 100%;
  min-height: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header__subtitle {
  margin: 0;
}

.muted {
  color: var(--sw-text-muted);
}

.error {
  color: var(--sw-danger-soft);
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-card {
  background: var(--sw-panel);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
}

.stat-value.positive { color: var(--sw-success); }
.stat-value.negative { color: var(--sw-danger-soft); }

.callout {
  padding: 0.85rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.callout.surplus {
  background: rgba(114, 219, 114, 0.12);
  color: var(--sw-success);
  border: 1px solid rgba(114, 219, 114, 0.25);
}

.callout.deficit {
  background: rgba(220, 38, 38, 0.12);
  color: var(--sw-danger-soft);
  border: 1px solid rgba(220, 38, 38, 0.25);
}

.annual-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}

.annual-row .positive { color: var(--sw-success); }
.annual-row .negative { color: var(--sw-danger-soft); }

.panel {
  background: var(--sw-panel);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.panel h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
  color: var(--sw-text-secondary);
}

.empty {
  text-align: center;
  color: var(--sw-text-muted);
}

.item-table {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ledger-table,
.category-table {
  display: grid;
  column-gap: 0.75rem;
  row-gap: 0.35rem;
}

.ledger-table {
  grid-template-columns:
    minmax(0, 1.5fr)
    minmax(0, 1fr)
    minmax(0, 0.9fr)
    minmax(0, 0.9fr)
    minmax(0, 0.9fr)
    minmax(9rem, auto);
}

.category-table {
  grid-template-columns:
    minmax(0, 1.2fr)
    repeat(4, minmax(0, 1fr));
}

.ledger-table .item-row,
.category-table .item-row {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
}

.item-row {
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--sw-border);
  font-size: 0.9rem;
}

.item-row:last-child {
  border-bottom: none;
}

.item-head {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sw-text-muted);
  border-bottom: 1px solid var(--sw-border-strong);
  padding-bottom: 0.5rem;
}

.item-name {
  font-weight: 500;
}

.item-actions {
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
}

.item-form label {
  display: block;
  margin-bottom: 0.85rem;
  font-size: 0.9rem;
  color: var(--sw-text-secondary);
}

.item-form input,
.item-form select {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  border-radius: 6px;
  color: var(--sw-text-primary);
}

.quick-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.chip {
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  color: var(--sw-text-primary);
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--sw-blue-bright);
}

.form-error {
  color: var(--sw-danger-soft);
  font-size: 0.85rem;
  margin: 0;
}

.positive { color: var(--sw-success); }
.negative { color: var(--sw-danger-soft); }

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .ledger-table,
  .category-table {
    display: flex;
    flex-direction: column;
  }

  .ledger-table .item-row,
  .category-table .item-row {
    display: grid;
    grid-template-columns: 1fr;
    grid-column: auto;
    gap: 0.25rem;
  }

  .item-head {
    display: none;
  }

  .item-actions {
    justify-content: flex-start;
    margin-top: 0.35rem;
  }
}
</style>
