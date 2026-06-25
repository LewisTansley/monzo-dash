import {
  getTransactions,
  getBalance,
  getPots,
  fetchMonthTransactionsWithCache
} from './monzoClient.js'
import {
  buildPotNamesSet,
  filterSpendableTransactions,
  isPotTransfer
} from './potTransfers.js'
import { deduplicateTransactionsById } from './transactionUtils.js'
import { getVaultData } from './vault.js'
import { formatMonthKey } from './monthUtils.js'
import {
  getMissingRequiredMonths,
  filterRealCacheGaps
} from './cacheCoverage.js'

const CACHE_GAP_REASON =
  'Some months are missing from the local transaction cache. Sync history in Settings or reconnect Monzo.'

const CATEGORIES = [
  'general', 'eating_out', 'expenses', 'transport', 'cash', 'bills',
  'entertainment', 'shopping', 'holidays', 'groceries', 'mondo'
]

function startOfYear() {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).toISOString()
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function daysInMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function daysElapsedInMonth() {
  return new Date().getDate()
}

async function fetchTransactionsInRange(since, rangeBefore = null) {
  const accountId = getVaultData().monzo.accountId
  const all = []
  let pageBefore = rangeBefore
  const sinceTime = new Date(since).getTime()

  for (let page = 0; page < 50; page++) {
    const opts = { accountId, since, limit: 100 }
    if (pageBefore) opts.before = pageBefore
    const res = await getTransactions(opts)
    const batch = res.transactions || []
    if (!batch.length) break
    all.push(...batch)
    const oldest = batch[batch.length - 1]
    if (new Date(oldest.created).getTime() < sinceTime) break
    pageBefore = oldest.id
    if (batch.length < 100) break
  }

  return deduplicateTransactionsById(
    all.filter((tx) => new Date(tx.created).getTime() >= sinceTime)
  )
}

async function fetchAllTransactionsSince(since) {
  return fetchTransactionsInRange(since)
}

async function fetchYtdTransactions() {
  const accountId = getVaultData().monzo.accountId
  const now = new Date()
  const year = now.getFullYear()
  const currentMonthKey = formatMonthKey(year, now.getMonth())
  const batches = []
  const failedMonthKeys = []
  let effectiveSince = null

  for (let month = now.getMonth(); month >= 0; month--) {
    const monthKey = formatMonthKey(year, month)
    const since = new Date(year, month, 1).toISOString()
    try {
      const { transactions } = await fetchMonthTransactionsWithCache(accountId, year, month)
      batches.push(...transactions)
      if (transactions.length) {
        effectiveSince = !effectiveSince || new Date(since) < new Date(effectiveSince)
          ? since
          : effectiveSince
      }
    } catch {
      failedMonthKeys.push(monthKey)
    }
  }

  const transactions = deduplicateTransactionsById(batches).sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  )

  const realGaps = filterRealCacheGaps(
    failedMonthKeys.filter((key) => key !== currentMonthKey)
  )
  const yearStart = formatMonthKey(year, 0)
  const incomplete =
    realGaps.length > 0 ||
    getMissingRequiredMonths(currentMonthKey, { rangeStart: yearStart }).length > 0

  return {
    transactions,
    verificationRequired: incomplete,
    failedMonthKeys: realGaps,
    effectiveSince: effectiveSince || startOfYear()
  }
}

function toDateKey(iso) {
  return iso.slice(0, 10)
}

function bucketByDay(transactions, since) {
  const start = new Date(since)
  const today = new Date()
  const days = {}

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    days[key] = { date: key, spend: 0, income: 0 }
  }

  for (const tx of transactions) {
    const key = toDateKey(tx.created)
    if (!days[key]) continue
    if (tx.amount < 0) {
      days[key].spend += Math.abs(tx.amount)
    } else if (tx.amount > 0) {
      days[key].income += tx.amount
    }
  }

  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
}

function aggregateTransactions(transactions, { includeDailySeries = false, since = null } = {}) {
  const byCategory = {}
  for (const cat of CATEGORIES) byCategory[cat] = { spend: 0, income: 0, count: 0 }

  let totalSpend = 0
  let totalIncome = 0

  for (const tx of transactions) {
    const amount = tx.amount
    const cat = tx.category || 'general'
    if (!byCategory[cat]) byCategory[cat] = { spend: 0, income: 0, count: 0 }

    if (amount < 0) {
      const spend = Math.abs(amount)
      totalSpend += spend
      byCategory[cat].spend += spend
    } else if (amount > 0) {
      totalIncome += amount
      byCategory[cat].income += amount
    }
    byCategory[cat].count += 1
  }

  const result = {
    totalSpend,
    totalIncome,
    net: totalIncome - totalSpend,
    byCategory,
    transactionCount: transactions.length
  }

  if (includeDailySeries && since) {
    result.dailySeries = bucketByDay(transactions, since)
  }

  return result
}

export async function getSummary(period) {
  const since = period === 'ytd' ? startOfYear() : startOfMonth()
  const accountId = getVaultData().monzo.accountId

  const [fetchResult, potsRes] = await Promise.all([
    period === 'ytd'
      ? fetchYtdTransactions()
      : fetchAllTransactionsSince(since).then((transactions) => ({
          transactions,
          verificationRequired: false,
          effectiveSince: since
        })),
    getPots(accountId).catch(() => ({ pots: [] }))
  ])

  const { transactions, verificationRequired, effectiveSince } = fetchResult
  const potNames = buildPotNamesSet(potsRes.pots || [])
  const excludedPotTransfers = transactions.filter((tx) => isPotTransfer(tx, potNames)).length
  const spendable = deduplicateTransactionsById(
    filterSpendableTransactions(transactions, potNames)
  )
  const seriesSince = verificationRequired ? effectiveSince : since

  return {
    period,
    since,
    effectiveSince: seriesSince,
    incomplete: verificationRequired,
    incompleteReason: verificationRequired ? CACHE_GAP_REASON : null,
    excludedPotTransfers,
    ...aggregateTransactions(spendable, {
      includeDailySeries: true,
      since: seriesSince
    })
  }
}

export async function getProjections() {
  const vault = getVaultData()
  const mtd = await getSummary('mtd')
  const balanceRes = await getBalance()
  const balance = balanceRes.balance || 0

  const elapsed = daysElapsedInMonth()
  const totalDays = daysInMonth()
  const dailyAvgSpend = elapsed > 0 ? mtd.totalSpend / elapsed : 0
  const projectedMonthSpend = Math.round(dailyAvgSpend * totalDays)
  const remainingDays = Math.max(0, totalDays - elapsed)
  const projectedRemainingSpend = Math.round(dailyAvgSpend * remainingDays)
  const projectedMonthEndBalance = balance - projectedRemainingSpend

  const budgets = vault.budgets || {}
  const budgetStatus = {}
  for (const [category, limit] of Object.entries(budgets)) {
    const spent = mtd.byCategory[category]?.spend || 0
    const dailyCat = elapsed > 0 ? spent / elapsed : 0
    const projectedCatSpend = Math.round(dailyCat * totalDays)
    budgetStatus[category] = {
      budget: limit,
      spent,
      remaining: limit - spent,
      percentUsed: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      projectedSpend: projectedCatSpend,
      projectedOverUnder: limit - projectedCatSpend
    }
  }

  return {
    balance,
    mtdSpend: mtd.totalSpend,
    dailyAvgSpend: Math.round(dailyAvgSpend),
    projectedMonthSpend,
    projectedMonthEndBalance,
    daysElapsed: elapsed,
    daysInMonth: totalDays,
    budgetStatus
  }
}
