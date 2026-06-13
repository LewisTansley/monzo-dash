import { spendableTransactions } from '../utils/transactionAnalytics.js'
import {
  flattenMonthColumns,
  monthKeysForPeriod,
  periodStartDate
} from '../utils/transactionFilters.js'

function monthKeyFromFeed(data) {
  return data?.month || null
}

function prevMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function hasMonth(columns, monthKey) {
  return (columns || []).some((col) => col.key === monthKey)
}

function mergeMonthColumn(columns, feed) {
  const key = monthKeyFromFeed(feed)
  if (!key) return columns

  const column = {
    key,
    label: feed.monthLabel,
    transactions: feed.transactions || []
  }

  const existing = (columns || []).findIndex((col) => col.key === key)
  if (existing >= 0) {
    const next = [...columns]
    next[existing] = column
    return next
  }
  return [...(columns || []), column]
}

export async function ensureTransactionsForPeriod({
  period,
  loadedMonths = [],
  fetchMonth
}) {
  let columns = [...loadedMonths]
  const requiredKeys = monthKeysForPeriod(period)
  const startDate = periodStartDate(period)

  for (const monthKey of requiredKeys) {
    if (hasMonth(columns, monthKey)) continue
    const feed = await fetchMonth(monthKey)
    columns = mergeMonthColumn(columns, feed)
  }

  if (period === 'ytd') {
    let cursor = requiredKeys[requiredKeys.length - 1]
    while (cursor) {
      const cursorStart = `${cursor}-01`
      if (cursorStart < startDate) break
      if (!hasMonth(columns, cursor)) {
        const feed = await fetchMonth(cursor)
        columns = mergeMonthColumn(columns, feed)
      }
      const prev = prevMonthKey(cursor)
      if (prev === cursor) break
      cursor = prev
    }
  }

  const flat = flattenMonthColumns(columns)
  return {
    columns,
    transactions: spendableTransactions(flat).filter(
      (tx) => tx.created.slice(0, 10) >= startDate
    )
  }
}

export function drilldownTransactions({
  transactions,
  category,
  date,
  seriesKey
}) {
  let result = transactions || []

  if (category) {
    if (Array.isArray(category)) {
      const keys = new Set(category)
      result = result.filter((tx) => keys.has(tx.category || 'general'))
    } else {
      result = result.filter((tx) => (tx.category || 'general') === category)
    }
  }

  if (date) {
    result = result.filter((tx) => tx.created.slice(0, 10) === date)
  }

  if (seriesKey === 'income') {
    result = result.filter((tx) => tx.amount > 0)
  } else if (seriesKey === 'spend') {
    result = result.filter((tx) => tx.amount < 0)
  }

  return result.sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  )
}

export function selectionSummary(transactions) {
  const list = transactions || []
  let spend = 0
  let income = 0
  for (const tx of list) {
    if (tx.amount < 0) spend += Math.abs(tx.amount)
    else if (tx.amount > 0) income += tx.amount
  }
  return {
    count: list.length,
    spend,
    income,
    net: income - spend
  }
}
