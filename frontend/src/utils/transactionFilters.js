export function periodStartDate(period) {
  const now = new Date()
  if (period === 'ytd') {
    return `${now.getFullYear()}-01-01`
  }
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}-01`
}

export function filterByCategory(transactions, category) {
  if (!category) return transactions || []
  if (Array.isArray(category)) {
    const keys = new Set(category)
    return (transactions || []).filter((tx) => keys.has(tx.category || 'general'))
  }
  return (transactions || []).filter(
    (tx) => (tx.category || 'general') === category
  )
}

export function filterByDate(transactions, isoDate) {
  if (!isoDate) return transactions || []
  return (transactions || []).filter((tx) => tx.created.slice(0, 10) === isoDate)
}

export function filterByPeriod(transactions, period) {
  const start = periodStartDate(period)
  return (transactions || []).filter((tx) => tx.created.slice(0, 10) >= start)
}

export function filterBySeries(transactions, seriesKey) {
  if (seriesKey === 'income') {
    return (transactions || []).filter((tx) => tx.amount > 0)
  }
  if (seriesKey === 'spend') {
    return (transactions || []).filter((tx) => tx.amount < 0)
  }
  return transactions || []
}

export function resolveCategoryKey(label, byCategory = {}) {
  if (!label) return null
  if (label === 'Other') return 'other'

  const normalized = label.toLowerCase().replace(/\s+/g, '_')
  if (byCategory[normalized]) return normalized

  const match = Object.keys(byCategory).find(
    (key) => key.replace(/_/g, ' ').toLowerCase() === label.toLowerCase()
  )
  return match || normalized
}

export function resolveOtherCategoryKeys(byCategory, topN = 6) {
  return Object.entries(byCategory || {})
    .filter(([, v]) => v.spend > 0)
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(topN)
    .map(([key]) => key)
}

export function otherCategoryKeys(byCategory, topN = 6) {
  const topKeys = new Set(
    Object.entries(byCategory || {})
      .filter(([, v]) => v.spend > 0)
      .sort((a, b) => b[1].spend - a[1].spend)
      .slice(0, topN)
      .map(([key]) => key)
  )
  return Object.entries(byCategory || {})
    .filter(([key, v]) => v.spend > 0 && !topKeys.has(key))
    .map(([key]) => key)
}

export function monthKeyFromDate(isoDate) {
  return isoDate.slice(0, 7)
}

export function monthKeysForPeriod(period) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (period === 'mtd') {
    return [`${year}-${String(month + 1).padStart(2, '0')}`]
  }

  const keys = []
  for (let m = month; m >= 0; m--) {
    keys.push(`${year}-${String(m + 1).padStart(2, '0')}`)
  }
  return keys
}

export function flattenMonthColumns(columns) {
  const seen = new Set()
  const all = []
  for (const column of columns || []) {
    for (const tx of column.transactions || []) {
      if (seen.has(tx.id)) continue
      seen.add(tx.id)
      all.push(tx)
    }
  }
  return all
}

export const MONZO_CATEGORIES = [
  'general',
  'eating_out',
  'expenses',
  'transport',
  'cash',
  'bills',
  'entertainment',
  'shopping',
  'holidays',
  'groceries'
]

export const PAYMENT_TYPES = [
  'card',
  'direct_debit',
  'transfer',
  'pot',
  'topup',
  'cash'
]

export const DEFAULT_KANBAN_FILTERS = {
  query: '',
  categories: [],
  paymentTypes: [],
  series: null,
  descriptions: [],
  hidePotTransfers: true
}

export function normalizeDescription(desc) {
  return (desc || '').trim().replace(/\s+/g, ' ')
}

function hasMerchant(tx) {
  const m = tx.merchant
  if (!m) return false
  if (typeof m === 'string') return Boolean(m)
  return Boolean(m.id)
}

function looksLikeDirectDebitDescription(desc) {
  const trimmed = (desc || '').trim()
  if (!trimmed) return false
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  if (!letters) return false
  const upperRatio = (trimmed.match(/[A-Z]/g) || []).length / letters.length
  return upperRatio >= 0.6
}

export function inferPaymentType(tx) {
  if (tx.isPotTransfer) return 'pot'
  if (tx.is_load) return 'topup'
  if (tx.category === 'cash') return 'cash'
  if (hasMerchant(tx)) return 'card'

  const isDebit = tx.amount < 0
  if (
    isDebit &&
    (tx.category === 'bills' || looksLikeDirectDebitDescription(tx.description))
  ) {
    return 'direct_debit'
  }

  if (!hasMerchant(tx)) return 'transfer'
  return 'card'
}

export function filterByQuery(transactions, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return transactions || []
  return (transactions || []).filter((tx) =>
    (tx.description || '').toLowerCase().includes(q)
  )
}

export function filterByPaymentTypes(transactions, types) {
  if (!types?.length) return transactions || []
  const allowed = new Set(types)
  return (transactions || []).filter((tx) => allowed.has(inferPaymentType(tx)))
}

export function filterByDescriptions(transactions, normalizedDescriptions) {
  if (!normalizedDescriptions?.length) return transactions || []
  const allowed = new Set(normalizedDescriptions.map(normalizeDescription))
  return (transactions || []).filter((tx) =>
    allowed.has(normalizeDescription(tx.description))
  )
}

export function filterByPotTransfers(transactions, hidePotTransfers) {
  if (!hidePotTransfers) return transactions || []
  return (transactions || []).filter((tx) => !tx.isPotTransfer)
}

export function isKanbanFiltersActive(filters) {
  const f = filters || DEFAULT_KANBAN_FILTERS
  return Boolean(
    f.query?.trim() ||
      f.categories?.length ||
      f.paymentTypes?.length ||
      f.series ||
      f.descriptions?.length ||
      f.hidePotTransfers === false
  )
}

export function applyKanbanFilters(transactions, filters) {
  const f = { ...DEFAULT_KANBAN_FILTERS, ...filters }
  let result = transactions || []
  result = filterByPotTransfers(result, f.hidePotTransfers)
  result = filterByQuery(result, f.query)
  if (f.categories?.length) {
    result = filterByCategory(result, f.categories)
  }
  if (f.paymentTypes?.length) {
    result = filterByPaymentTypes(result, f.paymentTypes)
  }
  if (f.descriptions?.length) {
    result = filterByDescriptions(result, f.descriptions)
  }
  if (f.series) {
    result = filterBySeries(result, f.series)
  }
  return result
}

export function collectFilterOptions(columns) {
  const flat = flattenMonthColumns(columns)
  const categorySet = new Set(MONZO_CATEGORIES)
  const descCounts = new Map()

  for (const tx of flat) {
    categorySet.add(tx.category || 'general')
    const norm = normalizeDescription(tx.description)
    if (!norm) continue
    const entry = descCounts.get(norm) || { description: norm, label: norm, count: 0 }
    entry.count += 1
    descCounts.set(norm, entry)
  }

  const categories = [...categorySet].sort()
  const recurringDescriptions = [...descCounts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 24)

  return { categories, recurringDescriptions }
}

export function summarizeKanbanMatches(columns, filters) {
  let count = 0
  let monthCount = 0
  for (const column of columns || []) {
    const filtered = applyKanbanFilters(column.transactions, filters)
    if (filtered.length) {
      monthCount += 1
      count += filtered.length
    }
  }
  return { count, monthCount }
}
