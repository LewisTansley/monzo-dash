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
