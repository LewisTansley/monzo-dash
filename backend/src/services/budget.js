import { v4 as uuidv4 } from 'uuid'
import { getVaultData, updateVault } from './vault.js'

const VALID_TYPES = new Set(['income', 'expense'])
const VALID_FREQUENCIES = new Set(['monthly', 'annual', 'one-off'])

function monthlyEquivalent(amount, frequency) {
  if (frequency === 'monthly') return amount
  if (frequency === 'annual') return Math.round(amount / 12)
  return 0
}

function annualContribution(amount, frequency) {
  if (frequency === 'monthly') return amount * 12
  if (frequency === 'annual') return amount
  return amount
}

function validateItemData(data, { partial = false } = {}) {
  if (!partial || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Name is required')
    }
  }
  if (!partial || data.type !== undefined) {
    if (!VALID_TYPES.has(data.type)) {
      throw new Error('Type must be income or expense')
    }
  }
  if (!partial || data.amount !== undefined) {
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      throw new Error('Amount must be greater than zero')
    }
  }
  if (!partial || data.frequency !== undefined) {
    if (!VALID_FREQUENCIES.has(data.frequency)) {
      throw new Error('Frequency must be monthly, annual, or one-off')
    }
  }
}

function enrichItem(item) {
  const monthly = monthlyEquivalent(item.amount, item.frequency)
  const annual = annualContribution(item.amount, item.frequency)
  return {
    ...item,
    monthlyEquivalent: monthly,
    annualContribution: annual
  }
}

export function computeSummary(items) {
  let monthlyIncome = 0
  let monthlyExpenses = 0
  let annualIncome = 0
  let annualExpenses = 0
  const byCategory = {}

  for (const item of items) {
    const monthly = monthlyEquivalent(item.amount, item.frequency)
    const annual = annualContribution(item.amount, item.frequency)
    const category = item.category || 'other'

    if (item.type === 'income') {
      monthlyIncome += monthly
      annualIncome += annual
    } else {
      monthlyExpenses += monthly
      annualExpenses += annual
    }

    if (!byCategory[category]) {
      byCategory[category] = {
        category,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        annualIncome: 0,
        annualExpenses: 0
      }
    }
    const bucket = byCategory[category]
    if (item.type === 'income') {
      bucket.monthlyIncome += monthly
      bucket.annualIncome += annual
    } else {
      bucket.monthlyExpenses += monthly
      bucket.annualExpenses += annual
    }
  }

  const monthlyNet = monthlyIncome - monthlyExpenses
  const annualNet = annualIncome - annualExpenses

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
    annualIncome,
    annualExpenses,
    annualNet,
    isSurplus: monthlyNet >= 0,
    isDeficit: monthlyNet < 0,
    savingsRate: monthlyIncome > 0 ? Math.round((monthlyNet / monthlyIncome) * 100) : 0,
    byCategory
  }
}

function ensureBudget(vault) {
  if (!vault.budget) {
    vault.budget = { items: [...(vault.homeBudget?.items || [])] }
    delete vault.homeBudget
  }
  if (!vault.budget.items) vault.budget.items = []
}

function getItems() {
  const vault = getVaultData()
  return vault.budget?.items || vault.homeBudget?.items || []
}

export function listItems() {
  return getItems()
}

export function getBudget() {
  const items = getItems().map(enrichItem)
  return {
    items,
    summary: computeSummary(items)
  }
}

export function createItem(data) {
  validateItemData(data)
  const item = {
    id: uuidv4(),
    name: data.name.trim(),
    type: data.type,
    amount: data.amount,
    frequency: data.frequency,
    category: data.category || 'other'
  }
  updateVault((v) => {
    ensureBudget(v)
    v.budget.items.push(item)
  })
  return enrichItem(item)
}

export function updateItem(id, data) {
  validateItemData(data, { partial: true })
  let updated = null
  updateVault((v) => {
    ensureBudget(v)
    const idx = v.budget.items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error('Item not found')
    const current = v.budget.items[idx]
    const next = { ...current, id }
    if (data.name !== undefined) next.name = data.name.trim()
    if (data.type !== undefined) next.type = data.type
    if (data.amount !== undefined) next.amount = data.amount
    if (data.frequency !== undefined) next.frequency = data.frequency
    if (data.category !== undefined) next.category = data.category || 'other'
    v.budget.items[idx] = next
    updated = next
  })
  return enrichItem(updated)
}

export function deleteItem(id) {
  updateVault((v) => {
    ensureBudget(v)
    const before = v.budget.items.length
    v.budget.items = v.budget.items.filter((i) => i.id !== id)
    if (v.budget.items.length === before) {
      throw new Error('Item not found')
    }
  })
}
