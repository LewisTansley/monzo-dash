import { periodStartDate } from './transactionFilters.js'

export function spendableTransactions(transactions) {
  return (transactions || []).filter((tx) => !tx.isPotTransfer)
}

export function buildPeriodDailySeries(transactions, period) {
  const start = periodStartDate(period)
  const startDate = new Date(start + 'T00:00:00')
  const today = new Date()
  const days = {}

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    days[key] = { date: key, spend: 0, income: 0 }
  }

  for (const tx of spendableTransactions(transactions)) {
    const key = tx.created.slice(0, 10)
    if (!days[key]) continue
    if (tx.amount < 0) {
      days[key].spend += Math.abs(tx.amount)
    } else if (tx.amount > 0) {
      days[key].income += tx.amount
    }
  }

  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildPotDailySeries(transactions, period) {
  const start = periodStartDate(period)
  const startDate = new Date(start + 'T00:00:00')
  const today = new Date()
  const days = {}

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    days[key] = { date: key, spend: 0, income: 0 }
  }

  for (const tx of transactions || []) {
    const key = tx.created.slice(0, 10)
    if (!days[key]) continue
    if (tx.amount < 0) {
      days[key].spend += Math.abs(tx.amount)
    } else if (tx.amount > 0) {
      days[key].income += tx.amount
    }
  }

  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildMonthDailySeries(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const monthIndex = month - 1
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days = {}

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days[key] = { date: key, spend: 0, income: 0 }
  }

  for (const tx of spendableTransactions(transactions)) {
    const key = tx.created.slice(0, 10)
    if (!days[key]) continue
    if (tx.amount < 0) {
      days[key].spend += Math.abs(tx.amount)
    } else if (tx.amount > 0) {
      days[key].income += tx.amount
    }
  }

  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
}

export function aggregateMonthTransactions(transactions) {
  let totalSpend = 0
  let totalIncome = 0
  const byCategory = {}

  for (const tx of spendableTransactions(transactions)) {
    const cat = tx.category || 'general'
    if (!byCategory[cat]) {
      byCategory[cat] = { spend: 0, income: 0 }
    }

    if (tx.amount < 0) {
      const spend = Math.abs(tx.amount)
      totalSpend += spend
      byCategory[cat].spend += spend
    } else if (tx.amount > 0) {
      totalIncome += tx.amount
      byCategory[cat].income += tx.amount
    }
  }

  return {
    totalSpend,
    totalIncome,
    net: totalIncome - totalSpend,
    byCategory
  }
}

export function topSpendCategories(byCategory, limit = 4) {
  return Object.entries(byCategory || {})
    .filter(([, v]) => v.spend > 0)
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' '),
      spend: value.spend
    }))
}
