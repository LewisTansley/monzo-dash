import {
  getBalance,
  getPots,
  fetchMonthTransactionsWithCache
} from './monzoClient.js'
import {
  buildPotNamesSet,
  filterSpendableTransactions,
  annotatePotTransfers,
  filterActivePots
} from './potTransfers.js'
import { deduplicateTransactionsById } from './transactionUtils.js'
import { getVaultData } from './vault.js'
import { getMonth, listCachedMonths } from './transactionCache.js'
import {
  filterRealCacheGaps,
  isRequiredMonth
} from './cacheCoverage.js'

const HORIZONS = [1, 3, 6, 12]
const MIN_POT_TXS_FOR_PACE = 3
/** Minimum spend+income (pence) for a prior-year month to count as real history. */
const MIN_BASELINE_ACTIVITY = 5000
/** Projected net at or below this (pence) is treated as uninformative. */
const NEAR_ZERO_NET = 500

function formatMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric'
  })
}

function todayDateKey() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function priorYearDateKey(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function paceRatio(current, prior) {
  if (prior > 0) return clamp(current / prior, 0.5, 2.0)
  return current > 0 ? 1.25 : 1
}

function blendedFactor(mtdCurrent, mtdPrior, ytdCurrent, ytdPrior) {
  return (
    0.5 * paceRatio(mtdCurrent, mtdPrior) +
    0.5 * paceRatio(ytdCurrent, ytdPrior)
  )
}

function totalsFromTransactions(transactions) {
  let spend = 0
  let income = 0
  for (const tx of transactions) {
    if (tx.amount < 0) spend += Math.abs(tx.amount)
    else if (tx.amount > 0) income += tx.amount
  }
  return { spend, income, net: income - spend }
}

function filterByDateRange(transactions, startKey, endKey) {
  return transactions.filter((tx) => {
    const key = tx.created.slice(0, 10)
    return key >= startKey && key <= endKey
  })
}

function tryOlderCachedMonth(year, month) {
  const cachedMonthsSet = new Set(listCachedMonths())
  for (let offset = 1; offset <= 3; offset++) {
    const olderYear = year - offset
    const olderKey = formatMonthKey(olderYear, month)
    if (!cachedMonthsSet.has(olderKey)) continue
    const cached = getMonth(olderKey)
    if (cached?.transactions?.length) {
      return { transactions: cached.transactions, year: olderYear }
    }
  }
  return null
}

function mtdDateRange(year, month, throughDateKey) {
  const startKey = new Date(year, month, 1).toISOString().slice(0, 10)
  const [, m, day] = throughDateKey.split('-').map(Number)
  const endKey = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { startKey, endKey }
}

async function fetchYtdTransactions(accountId) {
  const now = new Date()
  const year = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentMonthKey = formatMonthKey(year, currentMonth)
  const batches = []
  const failedMonthKeys = []

  for (let m = currentMonth; m >= 0; m--) {
    const monthKey = formatMonthKey(year, m)
    try {
      const { transactions } = await fetchMonthTransactionsWithCache(accountId, year, m)
      batches.push(...transactions)
    } catch {
      failedMonthKeys.push(monthKey)
    }
  }

  const historicalGaps = filterRealCacheGaps(
    failedMonthKeys.filter((key) => key !== currentMonthKey)
  )

  return {
    transactions: deduplicateTransactionsById(batches),
    verificationRequired: historicalGaps.length > 0,
    failedMonthKeys: historicalGaps
  }
}

/** Prior-year YTD through the same calendar month, one month at a time. */
async function fetchPriorYearYtdTransactions(accountId, priorYear, endMonth) {
  const batches = []
  const failedMonthKeys = []

  for (let m = 0; m <= endMonth; m++) {
    const monthKey = formatMonthKey(priorYear, m)
    if (!isRequiredMonth(monthKey)) continue
    try {
      const { transactions } = await fetchMonthTransactionsWithCache(accountId, priorYear, m)
      batches.push(...transactions)
    } catch {
      const older = tryOlderCachedMonth(priorYear, m)
      if (older) {
        batches.push(...older.transactions)
      } else {
        failedMonthKeys.push(monthKey)
      }
    }
  }

  const realGaps = filterRealCacheGaps(failedMonthKeys)

  return {
    transactions: deduplicateTransactionsById(batches),
    verificationRequired: realGaps.length > 0,
    failedMonthKeys: realGaps
  }
}

async function fetchPriorMtdTransactions(accountId, priorYear, month, priorAsOf) {
  const monthKey = formatMonthKey(priorYear, month)
  if (!isRequiredMonth(monthKey)) {
    return { transactions: [], verificationRequired: false }
  }

  const startKey = new Date(priorYear, month, 1).toISOString().slice(0, 10)
  try {
    const { transactions } = await fetchMonthTransactionsWithCache(accountId, priorYear, month)
    return {
      transactions: filterByDateRange(transactions, startKey, priorAsOf),
      verificationRequired: false
    }
  } catch {
    const older = tryOlderCachedMonth(priorYear, month)
    if (older) {
      const { startKey, endKey } = mtdDateRange(older.year, month, priorAsOf)
      return {
        transactions: filterByDateRange(older.transactions, startKey, endKey),
        verificationRequired: false
      }
    }
    return { transactions: [], verificationRequired: true }
  }
}

function projectionMonths() {
  const now = new Date()
  const months = []
  let year = now.getFullYear()
  let month = now.getMonth()

  for (let i = 0; i < 12; i++) {
    months.push({
      year,
      month,
      monthKey: formatMonthKey(year, month),
      label: formatMonthLabel(year, month),
      isCurrent: i === 0,
      baselineYear: year - 1,
      baselineMonth: month
    })
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return months
}

async function fetchMonthWithPots(accountId, year, month, pots) {
  try {
    const { transactions } = await fetchMonthTransactionsWithCache(accountId, year, month)
    return {
      transactions: annotatePotTransfers(transactions, pots),
      missing: false
    }
  } catch {
    return { transactions: [], missing: true }
  }
}

function spendableFromAnnotated(transactions, potNames) {
  return filterSpendableTransactions(transactions, potNames)
}

function aggregatePotFlows(transactions, potId) {
  let deposits = 0
  let withdrawals = 0
  for (const tx of transactions) {
    if (!tx.isPotTransfer || tx.potTransferPotId !== potId) continue
    if (tx.amount < 0) deposits += Math.abs(tx.amount)
    else if (tx.amount > 0) withdrawals += tx.amount
  }
  return { deposits, withdrawals, net: deposits - withdrawals }
}

function filterPotTransactions(transactions, potId) {
  return transactions.filter(
    (tx) => tx.isPotTransfer && tx.potTransferPotId === potId
  )
}

function projectMonthSpendIncome({
  isCurrent,
  currentMtd,
  priorFull,
  priorMtd,
  spendFactor,
  incomeFactor,
  baselineSource
}) {
  if (isCurrent) {
    const remainderSpend = Math.max(0, priorFull.spend - priorMtd.spend)
    const remainderIncome = Math.max(0, priorFull.income - priorMtd.income)
    const spend = Math.round(currentMtd.spend + remainderSpend * spendFactor)
    const income = Math.round(currentMtd.income + remainderIncome * incomeFactor)
    return { spend, income, net: income - spend }
  }
  if (baselineSource === 'ytdPace' || baselineSource === 'avgNet') {
    return {
      spend: priorFull.spend || 0,
      income: priorFull.income || 0,
      net: priorFull.net
    }
  }
  const spend = Math.round(priorFull.spend * spendFactor)
  const income = Math.round(priorFull.income * incomeFactor)
  return { spend, income, net: income - spend }
}

function projectPotMonth({
  isCurrent,
  currentMtd,
  priorFull,
  priorMtd,
  depositFactor,
  withdrawalFactor,
  baselineSource
}) {
  if (isCurrent) {
    const remainderDeposits = Math.max(0, priorFull.deposits - priorMtd.deposits)
    const remainderWithdrawals = Math.max(
      0,
      priorFull.withdrawals - priorMtd.withdrawals
    )
    const deposits = Math.round(
      currentMtd.deposits + remainderDeposits * depositFactor
    )
    const withdrawals = Math.round(
      currentMtd.withdrawals + remainderWithdrawals * withdrawalFactor
    )
    return { deposits, withdrawals, net: deposits - withdrawals }
  }
  if (baselineSource === 'ytdPace' || baselineSource === 'avgNet') {
    return {
      deposits: priorFull.deposits || 0,
      withdrawals: priorFull.withdrawals || 0,
      net: priorFull.net
    }
  }
  const deposits = Math.round(priorFull.deposits * depositFactor)
  const withdrawals = Math.round(priorFull.withdrawals * withdrawalFactor)
  return { deposits, withdrawals, net: deposits - withdrawals }
}

export function isInformativeBaseline(baseline) {
  if (!baseline) return false
  const activity = (baseline.spend || 0) + (baseline.income || 0)
  if (activity < MIN_BASELINE_ACTIVITY) return false
  return Math.abs(baseline.net || 0) > NEAR_ZERO_NET
}

export function isInformativePotBaseline(baseline) {
  if (!baseline) return false
  const activity = (baseline.deposits || 0) + (baseline.withdrawals || 0)
  if (activity < MIN_BASELINE_ACTIVITY) return false
  return Math.abs(baseline.net || 0) > NEAR_ZERO_NET
}

export function computeYtdMonthlyNet(transactions, year, throughMonth, potNames, pots) {
  const monthlyNets = []
  for (let m = 0; m <= throughMonth; m++) {
    const startKey = `${formatMonthKey(year, m)}-01`
    const endKey = new Date(year, m + 1, 0).toISOString().slice(0, 10)
    const monthTxs = filterByDateRange(transactions, startKey, endKey)
    const annotated = annotatePotTransfers(monthTxs, pots)
    const spendable = spendableFromAnnotated(annotated, potNames)
    monthlyNets.push(totalsFromTransactions(spendable).net)
  }
  if (!monthlyNets.length) return 0

  let weightedSum = 0
  let weightTotal = 0
  for (let i = 0; i < monthlyNets.length; i++) {
    const weight = i >= monthlyNets.length - 3 ? 2 : 1
    weightedSum += monthlyNets[i] * weight
    weightTotal += weight
  }
  return Math.round(weightedSum / weightTotal)
}

export function computeYtdMonthlyPotNet(potTransactions, potId, year, throughMonth) {
  const monthlyNets = []
  for (let m = 0; m <= throughMonth; m++) {
    const startKey = `${formatMonthKey(year, m)}-01`
    const endKey = new Date(year, m + 1, 0).toISOString().slice(0, 10)
    const monthTxs = filterByDateRange(potTransactions, startKey, endKey)
    monthlyNets.push(aggregatePotFlows(monthTxs, potId).net)
  }
  if (!monthlyNets.length) return 0

  let weightedSum = 0
  let weightTotal = 0
  for (let i = 0; i < monthlyNets.length; i++) {
    const weight = i >= monthlyNets.length - 3 ? 2 : 1
    weightedSum += monthlyNets[i] * weight
    weightTotal += weight
  }
  return Math.round(weightedSum / weightTotal)
}

export function applyYtdPaceWhenFlat(projected, { isCurrent, baselineSource, ytdMonthlyNet }) {
  if (isCurrent) return projected
  if (baselineSource === 'ytdPace' || baselineSource === 'avgNet') return projected
  if (Math.abs(projected.net) > NEAR_ZERO_NET) return projected
  if (Math.abs(ytdMonthlyNet) <= NEAR_ZERO_NET) return projected
  return { ...projected, net: ytdMonthlyNet }
}

export function averageBaseline(baselines) {
  const available = baselines.filter(Boolean)
  if (!available.length) {
    return { spend: 0, income: 0, net: 0, deposits: 0, withdrawals: 0 }
  }
  const sum = available.reduce(
    (acc, b) => ({
      spend: acc.spend + (b.spend || 0),
      income: acc.income + (b.income || 0),
      deposits: acc.deposits + (b.deposits || 0),
      withdrawals: acc.withdrawals + (b.withdrawals || 0)
    }),
    { spend: 0, income: 0, deposits: 0, withdrawals: 0 }
  )
  const n = available.length
  const spend = Math.round(sum.spend / n)
  const income = Math.round(sum.income / n)
  const deposits = Math.round(sum.deposits / n)
  const withdrawals = Math.round(sum.withdrawals / n)
  return {
    spend,
    income,
    net: income - spend,
    deposits,
    withdrawals,
    netPot: deposits - withdrawals
  }
}

export function averageMonthlyNet(baselines) {
  const available = baselines.filter(Boolean)
  if (!available.length) return 0
  const sum = available.reduce((acc, b) => acc + (b.net || 0), 0)
  return Math.round(sum / available.length)
}

export function averageMonthlyPotNet(baselines) {
  const available = baselines.filter(Boolean)
  if (!available.length) return 0
  const sum = available.reduce((acc, b) => acc + (b.net || 0), 0)
  return Math.round(sum / available.length)
}

function pickReferenceBaseline(availableBaselines) {
  return availableBaselines.find(Boolean) || null
}

export function baselineFromTargetNet(targetNet, referenceBaseline) {
  if (referenceBaseline && referenceBaseline.net !== 0) {
    const scale = targetNet / referenceBaseline.net
    return {
      spend: Math.round(Math.abs(referenceBaseline.spend || 0) * Math.abs(scale)),
      income: Math.round(Math.abs(referenceBaseline.income || 0) * Math.abs(scale)),
      net: targetNet
    }
  }
  if (targetNet >= 0) {
    return { spend: 0, income: Math.abs(targetNet), net: targetNet }
  }
  return { spend: Math.abs(targetNet), income: 0, net: targetNet }
}

export function potBaselineFromTargetNet(targetNet, referenceBaseline) {
  if (referenceBaseline && referenceBaseline.net !== 0) {
    const scale = targetNet / referenceBaseline.net
    return {
      deposits: Math.round(Math.abs(referenceBaseline.deposits || 0) * Math.abs(scale)),
      withdrawals: Math.round(Math.abs(referenceBaseline.withdrawals || 0) * Math.abs(scale)),
      net: targetNet
    }
  }
  if (targetNet >= 0) {
    return { deposits: Math.abs(targetNet), withdrawals: 0, net: targetNet }
  }
  return { deposits: 0, withdrawals: Math.abs(targetNet), net: targetNet }
}

export function resolveBaseline({
  baselineKey,
  baselineByKey,
  olderCacheByKey,
  availableBaselines,
  ytdMonthlyNet
}) {
  const prior = baselineByKey.get(baselineKey)
  if (prior && isInformativeBaseline(prior)) {
    return { ...prior, source: 'priorYear' }
  }

  const older = olderCacheByKey?.get(baselineKey)
  if (older && isInformativeBaseline(older)) {
    return { ...older, source: 'olderCache' }
  }

  const reference = pickReferenceBaseline(availableBaselines)
  if (ytdMonthlyNet !== 0) {
    return { ...baselineFromTargetNet(ytdMonthlyNet, reference), source: 'ytdPace' }
  }

  const avgNet = averageMonthlyNet(availableBaselines)
  return { ...baselineFromTargetNet(avgNet, reference), source: 'avgNet' }
}

export function resolvePotBaseline({
  baselineKey,
  potBaselines,
  olderPotCacheByKey,
  availablePotBaselines,
  ytdMonthlyPotNet
}) {
  const prior = potBaselines.get(baselineKey)
  if (prior && isInformativePotBaseline(prior)) {
    return { ...prior, source: 'priorYear' }
  }

  const older = olderPotCacheByKey?.get(baselineKey)
  if (older && isInformativePotBaseline(older)) {
    return { ...older, source: 'olderCache' }
  }

  const reference = pickReferenceBaseline(availablePotBaselines)
  if (ytdMonthlyPotNet !== 0) {
    return { ...potBaselineFromTargetNet(ytdMonthlyPotNet, reference), source: 'ytdPace' }
  }

  const avgNet = averageMonthlyPotNet(availablePotBaselines)
  return { ...potBaselineFromTargetNet(avgNet, reference), source: 'avgNet' }
}

function buildOlderCacheBaselines(missingBaselineEntries, potNames, pots) {
  const olderCacheByKey = new Map()
  const cachedMonthsSet = new Set(listCachedMonths())

  for (const { year, month, monthKey } of missingBaselineEntries) {
    for (let offset = 1; offset <= 3; offset++) {
      const olderKey = formatMonthKey(year - offset, month)
      if (!cachedMonthsSet.has(olderKey)) continue
      const cached = getMonth(olderKey)
      if (!cached?.transactions?.length) continue
      const annotated = annotatePotTransfers(cached.transactions, pots)
      const spendable = spendableFromAnnotated(annotated, potNames)
      olderCacheByKey.set(monthKey, totalsFromTransactions(spendable))
      break
    }
  }

  return olderCacheByKey
}

function buildOlderPotCacheBaselines(missingBaselineEntries, pots, potId) {
  const olderPotCacheByKey = new Map()
  const cachedMonthsSet = new Set(listCachedMonths())

  for (const { year, month, monthKey } of missingBaselineEntries) {
    for (let offset = 1; offset <= 3; offset++) {
      const olderKey = formatMonthKey(year - offset, month)
      if (!cachedMonthsSet.has(olderKey)) continue
      const cached = getMonth(olderKey)
      if (!cached?.transactions?.length) continue
      const annotated = annotatePotTransfers(cached.transactions, pots)
      const flows = aggregatePotFlows(filterPotTransactions(annotated, potId), potId)
      olderPotCacheByKey.set(monthKey, flows)
      break
    }
  }

  return olderPotCacheByKey
}

export function buildHorizons(monthlyProjections, balance) {
  const horizons = {}
  for (const n of HORIZONS) {
    const slice = monthlyProjections.slice(0, n)
    const projectedNet = slice.reduce((sum, m) => sum + m.projected.net, 0)
    horizons[n] = {
      months: n,
      projectedNet,
      projectedBalance: balance + projectedNet
    }
  }
  return horizons
}

function buildPotHorizons(potMonthlyProjections, potBalance) {
  const horizons = {}
  for (const n of HORIZONS) {
    const projectedGrowth = potMonthlyProjections
      .slice(0, n)
      .reduce((sum, m) => sum + m.projected.net, 0)
    horizons[n] = {
      months: n,
      projectedGrowth,
      projectedBalance: potBalance + projectedGrowth
    }
  }
  return horizons
}

function buildPaceBlock(mtdCurrent, mtdPrior, ytdCurrent, ytdPrior) {
  const mtdSpendFactor = paceRatio(mtdCurrent.spend, mtdPrior.spend)
  const mtdIncomeFactor = paceRatio(mtdCurrent.income, mtdPrior.income)
  const ytdSpendFactor = paceRatio(ytdCurrent.spend, ytdPrior.spend)
  const ytdIncomeFactor = paceRatio(ytdCurrent.income, ytdPrior.income)
  return {
    mtd: {
      spendFactor: mtdSpendFactor,
      incomeFactor: mtdIncomeFactor
    },
    ytd: {
      spendFactor: ytdSpendFactor,
      incomeFactor: ytdIncomeFactor
    },
    blended: {
      spendFactor: blendedFactor(
        mtdCurrent.spend,
        mtdPrior.spend,
        ytdCurrent.spend,
        ytdPrior.spend
      ),
      incomeFactor: blendedFactor(
        mtdCurrent.income,
        mtdPrior.income,
        ytdCurrent.income,
        ytdPrior.income
      )
    }
  }
}

export async function getForecast() {
  const vault = getVaultData()
  const accountId = vault.monzo.accountId
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const asOf = todayDateKey()
  const priorAsOf = priorYearDateKey(asOf)
  const priorYtdSince = new Date(year - 1, 0, 1).toISOString()

  const months = projectionMonths()
  const uniqueBaselineKeys = new Map()
  for (const m of months) {
    const key = formatMonthKey(m.baselineYear, m.baselineMonth)
    if (!uniqueBaselineKeys.has(key)) {
      uniqueBaselineKeys.set(key, { year: m.baselineYear, month: m.baselineMonth })
    }
  }

  const mtdStartKey = new Date(year, month, 1).toISOString().slice(0, 10)

  const [balanceRes, potsRes, ytdResult, priorMtdResult, priorYtdResult] =
    await Promise.all([
      getBalance().catch(() => ({ balance: 0 })),
      getPots(accountId).catch(() => ({ pots: [] })),
      fetchYtdTransactions(accountId),
      fetchPriorMtdTransactions(accountId, year - 1, month, priorAsOf),
      fetchPriorYearYtdTransactions(accountId, year - 1, month)
    ])

  const mtdTxs = filterByDateRange(ytdResult.transactions, mtdStartKey, asOf)
  const priorMtdTxs = priorMtdResult.transactions
  const priorYtdTxs = priorYtdResult.transactions

  const pots = filterActivePots(potsRes.pots || [])

  const baselineResults = await Promise.all(
    Array.from(uniqueBaselineKeys.values()).map(({ year: y, month: mo }) =>
      fetchMonthWithPots(accountId, y, mo, pots).then((r) => ({
        ...r,
        year: y,
        month: mo,
        monthKey: formatMonthKey(y, mo)
      }))
    )
  )

  const potNames = buildPotNamesSet(pots)
  const balance = balanceRes.balance || 0

  const annotate = (txs) => annotatePotTransfers(txs, pots)

  const mtdAnnotated = annotate(mtdTxs)
  const ytdAnnotated = annotate(ytdResult.transactions)
  const priorMtdAnnotated = annotate(priorMtdTxs)
  const priorYtdAnnotated = annotate(priorYtdTxs)

  const mtdSpendable = spendableFromAnnotated(mtdAnnotated, potNames)
  const ytdSpendable = spendableFromAnnotated(ytdAnnotated, potNames)
  const priorMtdSpendable = spendableFromAnnotated(priorMtdAnnotated, potNames)
  const priorYtdSpendable = filterByDateRange(
    spendableFromAnnotated(priorYtdAnnotated, potNames),
    priorYtdSince.slice(0, 10),
    priorAsOf
  )

  const mtdCurrent = totalsFromTransactions(mtdSpendable)
  const ytdCurrent = totalsFromTransactions(ytdSpendable)
  const mtdPrior = totalsFromTransactions(priorMtdSpendable)
  const ytdPrior = totalsFromTransactions(priorYtdSpendable)

  const pace = buildPaceBlock(mtdCurrent, mtdPrior, ytdCurrent, ytdPrior)
  const { spendFactor, incomeFactor } = pace.blended

  const missingMonths = []

  const baselineByKey = new Map()
  for (const result of baselineResults) {
    if (result.missing) {
      missingMonths.push(result.monthKey)
      baselineByKey.set(result.monthKey, null)
      continue
    }
    const spendable = spendableFromAnnotated(result.transactions, potNames)
    baselineByKey.set(result.monthKey, totalsFromTransactions(spendable))
  }

  const availableBaselines = Array.from(baselineByKey.values()).filter(Boolean)
  const missingBaselineEntries = Array.from(uniqueBaselineKeys.values())
    .map(({ year: y, month: mo }) => ({
      year: y,
      month: mo,
      monthKey: formatMonthKey(y, mo)
    }))
    .filter(({ monthKey }) => !baselineByKey.get(monthKey))

  const olderCacheByKey = buildOlderCacheBaselines(missingBaselineEntries, potNames, pots)

  let incomplete =
    ytdResult.verificationRequired ||
    priorMtdResult.verificationRequired ||
    priorYtdResult.verificationRequired

  for (const monthKey of missingMonths) {
    if (!isRequiredMonth(monthKey)) continue
    if (!olderCacheByKey.has(monthKey)) {
      incomplete = true
      break
    }
  }
  const ytdMonthlyNet = computeYtdMonthlyNet(
    ytdAnnotated,
    year,
    month,
    potNames,
    pots
  )

  const currentBaselineKey = formatMonthKey(year - 1, month)
  const currentResolved = resolveBaseline({
    baselineKey: currentBaselineKey,
    baselineByKey,
    olderCacheByKey,
    availableBaselines,
    ytdMonthlyNet
  })
  const currentPriorFull = currentResolved
  const currentPriorMtd = mtdPrior

  const monthlyProjections = months.map((m) => {
    const baselineKey = formatMonthKey(m.baselineYear, m.baselineMonth)
    const resolved = resolveBaseline({
      baselineKey,
      baselineByKey,
      olderCacheByKey,
      availableBaselines,
      ytdMonthlyNet
    })
    const priorFull = resolved
    const priorYear = {
      spend: priorFull.spend,
      income: priorFull.income,
      net: priorFull.net
    }
    const rawProjected = projectMonthSpendIncome({
      isCurrent: m.isCurrent,
      currentMtd: mtdCurrent,
      priorFull: m.isCurrent ? currentPriorFull : priorFull,
      priorMtd: m.isCurrent ? currentPriorMtd : { spend: 0, income: 0, net: 0 },
      spendFactor,
      incomeFactor,
      baselineSource: resolved.source
    })
    const projected = applyYtdPaceWhenFlat(rawProjected, {
      isCurrent: m.isCurrent,
      baselineSource: resolved.source,
      ytdMonthlyNet
    })
    const usedYtdOverride =
      !m.isCurrent &&
      resolved.source === 'priorYear' &&
      rawProjected.net !== projected.net
    return {
      monthKey: m.monthKey,
      label: m.label,
      isCurrent: m.isCurrent,
      priorYear,
      projected,
      baselineSource: usedYtdOverride ? 'ytdPace' : resolved.source,
      usedFallback: resolved.source !== 'priorYear' || usedYtdOverride
    }
  })

  const horizons = buildHorizons(monthlyProjections, balance)

  let savingsPot = null
  const savingsPotId = vault.forecast?.savingsPotId || null

  if (savingsPotId) {
    const pot = pots.find((p) => p.id === savingsPotId)
    if (!pot) {
      savingsPot = { id: savingsPotId, missing: true }
    } else {
      const potMtd = aggregatePotFlows(
        filterPotTransactions(mtdAnnotated, savingsPotId),
        savingsPotId
      )
      const potYtd = aggregatePotFlows(
        filterPotTransactions(ytdAnnotated, savingsPotId),
        savingsPotId
      )
      const potPriorMtd = aggregatePotFlows(
        filterPotTransactions(priorMtdAnnotated, savingsPotId),
        savingsPotId
      )
      const potPriorYtd = aggregatePotFlows(
        filterByDateRange(
          filterPotTransactions(priorYtdAnnotated, savingsPotId),
          priorYtdSince.slice(0, 10),
          priorAsOf
        ),
        savingsPotId
      )

      const potMtdTxCount = filterPotTransactions(priorMtdAnnotated, savingsPotId).length
      const usedAccountFallback = potMtdTxCount < MIN_POT_TXS_FOR_PACE

      let depositFactor
      let withdrawalFactor
      if (usedAccountFallback) {
        depositFactor = spendFactor
        withdrawalFactor = incomeFactor
      } else {
        depositFactor = blendedFactor(
          potMtd.deposits,
          potPriorMtd.deposits,
          potYtd.deposits,
          potPriorYtd.deposits
        )
        withdrawalFactor = blendedFactor(
          potMtd.withdrawals,
          potPriorMtd.withdrawals,
          potYtd.withdrawals,
          potPriorYtd.withdrawals
        )
      }

      const potBaselines = new Map()
      for (const result of baselineResults) {
        if (result.missing) {
          potBaselines.set(result.monthKey, null)
          continue
        }
        const flows = aggregatePotFlows(
          filterPotTransactions(result.transactions, savingsPotId),
          savingsPotId
        )
        potBaselines.set(result.monthKey, flows)
      }

      const availablePotBaselines = Array.from(potBaselines.values()).filter(Boolean)
      const olderPotCacheByKey = buildOlderPotCacheBaselines(
        missingBaselineEntries,
        pots,
        savingsPotId
      )
      const ytdMonthlyPotNet = computeYtdMonthlyPotNet(
        filterPotTransactions(ytdAnnotated, savingsPotId),
        savingsPotId,
        year,
        month
      )

      const currentPotResolved = resolvePotBaseline({
        baselineKey: currentBaselineKey,
        potBaselines,
        olderPotCacheByKey,
        availablePotBaselines,
        ytdMonthlyPotNet
      })

      const potMonthlyProjections = months.map((m) => {
        const baselineKey = formatMonthKey(m.baselineYear, m.baselineMonth)
        const resolved = resolvePotBaseline({
          baselineKey,
          potBaselines,
          olderPotCacheByKey,
          availablePotBaselines,
          ytdMonthlyPotNet
        })
        const priorFull = resolved
        const priorYear = {
          deposits: priorFull.deposits,
          withdrawals: priorFull.withdrawals,
          net: priorFull.net
        }
        const rawProjected = projectPotMonth({
          isCurrent: m.isCurrent,
          currentMtd: potMtd,
          priorFull: m.isCurrent ? currentPotResolved : priorFull,
          priorMtd: m.isCurrent ? potPriorMtd : { deposits: 0, withdrawals: 0, net: 0 },
          depositFactor,
          withdrawalFactor,
          baselineSource: resolved.source
        })
        const projected = applyYtdPaceWhenFlat(rawProjected, {
          isCurrent: m.isCurrent,
          baselineSource: resolved.source,
          ytdMonthlyNet: ytdMonthlyPotNet
        })
        const usedYtdOverride =
          !m.isCurrent &&
          resolved.source === 'priorYear' &&
          rawProjected.net !== projected.net
        return {
          monthKey: m.monthKey,
          label: m.label,
          isCurrent: m.isCurrent,
          priorYear,
          projected,
          baselineSource: usedYtdOverride ? 'ytdPace' : resolved.source
        }
      })

      let cumulative = pot.balance || 0
      const potMonthlyWithBalance = potMonthlyProjections.map((m) => {
        cumulative += m.projected.net
        return { ...m, projectedBalance: cumulative }
      })

      const potPace = {
        mtd: {
          depositFactor: paceRatio(potMtd.deposits, potPriorMtd.deposits),
          withdrawalFactor: paceRatio(potMtd.withdrawals, potPriorMtd.withdrawals)
        },
        ytd: {
          depositFactor: paceRatio(potYtd.deposits, potPriorYtd.deposits),
          withdrawalFactor: paceRatio(potYtd.withdrawals, potPriorYtd.withdrawals)
        },
        blended: { depositFactor, withdrawalFactor },
        usedAccountFallback
      }

      savingsPot = {
        id: pot.id,
        name: pot.name,
        currentBalance: pot.balance || 0,
        pace: potPace,
        monthlyProjections: potMonthlyWithBalance,
        horizons: buildPotHorizons(potMonthlyProjections, pot.balance || 0)
      }
    }
  }

  return {
    asOf,
    balance,
    incomplete,
    incompleteReason: incomplete
      ? 'Some months are missing from the local transaction cache. Sync history in Settings or reconnect Monzo.'
      : null,
    missingMonths,
    pace,
    comparisons: {
      mtd: { current: mtdCurrent, priorYear: mtdPrior },
      ytd: { current: ytdCurrent, priorYear: ytdPrior }
    },
    monthlyProjections,
    horizons,
    savingsPot
  }
}
