import { spendableTransactions } from '../utils/transactionAnalytics.js'
import { matchesPot } from '../utils/potTransfers.js'
import {
  flattenMonthColumns,
  monthKeysForPeriod,
  normalizeDescription,
  periodStartDate
} from '../utils/transactionFilters.js'

const MAX_DRILLDOWN_MONTHS = 60

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
  fetchMonth,
  includePotTransfers = false
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
  const scoped = includePotTransfers ? flat : spendableTransactions(flat)
  return {
    columns,
    transactions: scoped.filter((tx) => tx.created.slice(0, 10) >= startDate)
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

export function drilldownPotTransactions({
  transactions,
  pot,
  date,
  seriesKey
}) {
  let result = (transactions || []).filter((tx) => matchesPot(tx, pot))

  if (date) {
    result = result.filter((tx) => tx.created.slice(0, 10) === date)
  }

  if (seriesKey === 'deposit' || seriesKey === 'spend') {
    result = result.filter((tx) => tx.amount < 0)
  } else if (seriesKey === 'withdraw' || seriesKey === 'income') {
    result = result.filter((tx) => tx.amount > 0)
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

function resolvePotForTransfer(anchorTx, pots) {
  if (!anchorTx?.isPotTransfer) return null
  if (anchorTx.potTransferPotId) {
    const match = (pots || []).find((p) => p.id === anchorTx.potTransferPotId)
    if (match) return match
    return {
      id: anchorTx.potTransferPotId,
      name: (anchorTx.description || '').trim() || 'Pot'
    }
  }
  return (pots || []).find((p) => matchesPot(anchorTx, p)) || null
}

export function resolveTransactionDrilldown(anchorTx, pots = []) {
  if (!anchorTx) return null

  if (anchorTx.isPotTransfer) {
    const pot = resolvePotForTransfer(anchorTx, pots)
    const label = pot?.name || (anchorTx.description || '').trim() || 'Pot'
    return {
      type: 'pot',
      label,
      pot,
      match(tx) {
        if (!pot) return false
        return matchesPot(tx, pot)
      }
    }
  }

  const description = normalizeDescription(anchorTx.description)
  return {
    type: 'description',
    label: description || 'Transaction',
    description,
    match(tx) {
      return normalizeDescription(tx.description) === description
    }
  }
}

export function drilldownRelatedTransactions({ anchorTx, transactions, pots = [] }) {
  const rule = resolveTransactionDrilldown(anchorTx, pots)
  if (!rule) return []

  return (transactions || [])
    .filter((tx) => rule.match(tx))
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
}

export function drilldownTitle(drilldown) {
  if (!drilldown) return 'Transactions'
  return drilldown.type === 'pot' ? 'Pot transfers' : 'Matching transactions'
}

export async function ensureTransactionsForDrilldown({
  loadedMonths = [],
  fetchMonth,
  pagination,
  onColumnsUpdate,
  maxMonths = MAX_DRILLDOWN_MONTHS
}) {
  let columns = [...loadedMonths]

  while (pagination?.hasMore && pagination?.nextMonth && columns.length < maxMonths) {
    const feed = await fetchMonth(pagination.nextMonth)
    columns = mergeMonthColumn(columns, feed)
    if (onColumnsUpdate) onColumnsUpdate(columns)

    pagination.hasMore = Boolean(feed.hasMore)
    pagination.nextMonth = feed.nextMonth || null

    if (feed.verificationRequired) {
      pagination.hasMore = false
      pagination.nextMonth = null
    }
  }

  return {
    columns,
    transactions: flattenMonthColumns(columns)
  }
}
