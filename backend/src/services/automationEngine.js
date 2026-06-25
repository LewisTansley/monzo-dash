import { v4 as uuidv4 } from 'uuid'
import {
  getBalance,
  getPots,
  depositToPot,
  withdrawFromPot
} from './monzoClient.js'
import { getVaultData, updateVault } from './vault.js'
import {
  buildTriggerStateRecord,
  getTransferDedupeId,
  normalizeAutoTrigger
} from './automationTriggers.js'
import { config } from '../config.js'
import { appendAutomationActivity } from './automationActivity.js'

const OPERATORS = {
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  eq: (a, b) => a === b
}

async function resolveBalance(source) {
  const accountId = getVaultData().monzo.accountId
  if (source.type === 'account') {
    const bal = await getBalance(accountId)
    return bal.balance || 0
  }
  if (source.type === 'pot') {
    const potsRes = await getPots(accountId)
    const pot = (potsRes.pots || []).find((p) => p.id === source.id)
    return pot?.balance ?? 0
  }
  return 0
}

function splitSourceKey(key) {
  const idx = key.indexOf(':')
  if (idx === -1) return { type: key, id: '' }
  return { type: key.slice(0, idx), id: key.slice(idx + 1) }
}

function resolveConditionValue(condition, sourceBalance) {
  const { value } = condition
  if (value.mode === 'percent') {
    return Math.round((sourceBalance * value.amount) / 100)
  }
  return value.amount
}

export function evaluateConditions(automation, balances) {
  const { conditions, conditionLogic = 'all' } = automation
  if (!conditions?.length) return { met: true, details: [] }

  const results = conditions.map((cond) => {
    const key = `${cond.source.type}:${cond.source.id}`
    const balance = balances[key] ?? 0
    const threshold = resolveConditionValue(cond, balance)
    const op = OPERATORS[cond.operator]
    const met = op ? op(balance, threshold) : false
    return { condition: cond, balance, threshold, met }
  })

  const met =
    conditionLogic === 'any'
      ? results.some((r) => r.met)
      : results.every((r) => r.met)

  return { met, details: results }
}

export function getFundingBalance(action, balances, accountIdOverride = null) {
  const accountId = accountIdOverride ?? getVaultData().monzo.accountId
  if (action.type === 'deposit') {
    const sourceKey = `${action.source?.type}:${action.source?.id}`
    return (
      balances[`account:${accountId}`] ??
      balances[sourceKey] ??
      0
    )
  }
  const sourceKey = `${action.source.type}:${action.source.id}`
  return balances[sourceKey] ?? 0
}

async function resolveLiveFundingBalance(action) {
  const accountId = getVaultData().monzo.accountId
  if (action.type === 'deposit') {
    const bal = await getBalance(accountId)
    return bal.balance || 0
  }
  const potsRes = await getPots(accountId)
  const pot = (potsRes.pots || []).find((p) => p.id === action.source.id)
  return pot?.balance ?? 0
}

function isPotLtCondition(d, potId) {
  const c = d.condition
  return (
    c.source.type === 'pot' &&
    c.source.id === potId &&
    (c.operator === 'lt' || c.operator === 'lte')
  )
}

function isPotGtCondition(d, potId) {
  const c = d.condition
  return (
    c.source.type === 'pot' &&
    c.source.id === potId &&
    (c.operator === 'gt' || c.operator === 'gte')
  )
}

function findDestinationPotTopUpCondition(action, conditionDetails) {
  if (action.type !== 'deposit') return null
  const destId = action.destination?.id
  if (destId) {
    const exact = conditionDetails.find((d) => isPotLtCondition(d, destId))
    if (exact) return exact
  }
  const ltPotConditions = conditionDetails.filter((d) => {
    const c = d.condition
    return (
      c.source.type === 'pot' &&
      (c.operator === 'lt' || c.operator === 'lte')
    )
  })
  if (ltPotConditions.length === 1) return ltPotConditions[0]
  return null
}

function findSourcePotDrawdownCondition(action, conditionDetails) {
  if (action.type !== 'withdraw') return null
  const srcId = action.source?.id
  if (srcId) {
    const exact = conditionDetails.find((d) => isPotGtCondition(d, srcId))
    if (exact) return exact
  }
  const gtPotConditions = conditionDetails.filter((d) => {
    const c = d.condition
    return (
      c.source.type === 'pot' &&
      (c.operator === 'gt' || c.operator === 'gte')
    )
  })
  if (gtPotConditions.length === 1) return gtPotConditions[0]
  return null
}

function isAccountGtCondition(d) {
  const c = d.condition
  return (
    c.source.type === 'account' &&
    (c.operator === 'gt' || c.operator === 'gte')
  )
}

function isAccountLtCondition(d) {
  const c = d.condition
  return (
    c.source.type === 'account' &&
    (c.operator === 'lt' || c.operator === 'lte')
  )
}

function findAccountExcessCondition(conditionDetails) {
  const gtAccountConditions = conditionDetails.filter(isAccountGtCondition)
  if (gtAccountConditions.length === 1) return gtAccountConditions[0]
  return null
}

function findAccountShortfallCondition(conditionDetails) {
  const ltAccountConditions = conditionDetails.filter(isAccountLtCondition)
  if (ltAccountConditions.length === 1) return ltAccountConditions[0]
  return null
}

function findPrimaryConditionDetail(action, conditionDetails) {
  if (!conditionDetails?.length) return null

  if (action.type === 'deposit') {
    const destId = action.destination?.id
    if (destId) {
      const onDest = conditionDetails.find(
        (d) =>
          d.condition.source.type === 'pot' && d.condition.source.id === destId
      )
      if (onDest) return onDest
    }
  } else if (action.type === 'withdraw') {
    const srcId = action.source?.id
    if (srcId) {
      const onSrc = conditionDetails.find(
        (d) =>
          d.condition.source.type === 'pot' && d.condition.source.id === srcId
      )
      if (onSrc) return onSrc
    }
    const onAccount = conditionDetails.find(
      (d) => d.condition.source.type === 'account'
    )
    if (onAccount) return onAccount
  }

  return conditionDetails[0]
}

function computeRemainderTransfer(detail, fundingBalance, amountMode) {
  const { balance: conditionBalance, threshold, condition } = detail
  const op = condition.operator

  let transfer = 0
  if (amountMode === 'remainder') {
    transfer = conditionBalance - threshold
  } else if (amountMode === 'remainder_below') {
    transfer = threshold - conditionBalance
  } else if (op === 'gt' || op === 'gte') {
    transfer = conditionBalance - threshold
  } else if (op === 'lt' || op === 'lte') {
    transfer = threshold - conditionBalance
  }

  return Math.max(0, Math.min(transfer, fundingBalance))
}

function findRemainderConditionDetail(action, conditionDetails, amountMode) {
  if (amountMode === 'remainder') {
    if (action.type === 'withdraw') {
      const drawDown = findSourcePotDrawdownCondition(action, conditionDetails)
      if (drawDown) return drawDown
    }
    if (action.type === 'deposit') {
      const excess = findAccountExcessCondition(conditionDetails)
      if (excess) return excess
    }
  } else if (amountMode === 'remainder_below') {
    if (action.type === 'deposit') {
      const topUp = findDestinationPotTopUpCondition(action, conditionDetails)
      if (topUp) return topUp
    }
    if (action.type === 'withdraw') {
      const shortfall = findAccountShortfallCondition(conditionDetails)
      if (shortfall) return shortfall
    }
  }

  return findPrimaryConditionDetail(action, conditionDetails)
}

export function computeActionAmount(automation, balances, conditionDetails, accountIdOverride = null) {
  const { action } = automation
  const { amount } = action
  let fundingBalance = getFundingBalance(action, balances, accountIdOverride)

  if (amount.mode === 'remainder' && action.type === 'withdraw') {
    const drawDown = findSourcePotDrawdownCondition(action, conditionDetails)
    if (drawDown) {
      const potKey = `pot:${drawDown.condition.source.id}`
      fundingBalance = balances[potKey] ?? fundingBalance
    }
  }

  if (amount.mode === 'fixed') {
    const topUp = findDestinationPotTopUpCondition(action, conditionDetails)
    if (topUp) {
      const needed = amount.value - topUp.balance
      return Math.max(0, Math.min(needed, fundingBalance))
    }
    const drawDown = findSourcePotDrawdownCondition(action, conditionDetails)
    if (drawDown) {
      const excess = drawDown.balance - amount.value
      return Math.max(0, Math.min(excess, fundingBalance))
    }
    return Math.min(amount.value, fundingBalance)
  }

  const primaryCondition = findPrimaryConditionDetail(action, conditionDetails)

  if (amount.mode === 'percent') {
    const basis =
      amount.basis === 'condition_threshold' && primaryCondition
        ? primaryCondition.threshold
        : fundingBalance
    return Math.min(Math.round((basis * amount.value) / 100), fundingBalance)
  }

  if (amount.mode === 'remainder' || amount.mode === 'remainder_below') {
    const remainderCondition = findRemainderConditionDetail(
      action,
      conditionDetails,
      amount.mode
    )
    if (remainderCondition) {
      return computeRemainderTransfer(
        remainderCondition,
        fundingBalance,
        amount.mode
      )
    }
  }

  return 0
}

function collectAutomationSourceKeys(automation, accountId) {
  const sources = new Set()
  for (const c of automation.conditions || []) {
    sources.add(`${c.source.type}:${c.source.id}`)
  }
  sources.add(`${automation.action.source.type}:${automation.action.source.id}`)
  if (
    (automation.action.type === 'deposit' || automation.action.type === 'withdraw') &&
    accountId
  ) {
    sources.add(`account:${accountId}`)
  }
  if (automation.action.type === 'deposit' && automation.action.destination?.id) {
    sources.add(`pot:${automation.action.destination.id}`)
  }
  if (automation.action.type === 'withdraw' && automation.action.source?.id) {
    sources.add(`pot:${automation.action.source.id}`)
  }
  return sources
}

async function resolveAutomationBalances(automation, balanceOverrides = null) {
  const accountId = getVaultData().monzo.accountId
  const sources = collectAutomationSourceKeys(automation, accountId)
  const balances = {}

  for (const key of sources) {
    if (balanceOverrides && key in balanceOverrides) {
      balances[key] = balanceOverrides[key]
      continue
    }
    const { type, id } = splitSourceKey(key)
    balances[key] = await resolveBalance({ type, id })
  }

  return balances
}

export function applyTransferToBalances(action, amount, balances, accountId) {
  if (amount <= 0) return

  const accountKey = `account:${accountId}`
  if (action.type === 'deposit') {
    const destKey = `pot:${action.destination.id}`
    balances[destKey] = (balances[destKey] ?? 0) + amount
    balances[accountKey] = (balances[accountKey] ?? 0) - amount
    const legacyKey = `${action.source?.type}:${action.source?.id}`
    if (legacyKey in balances) {
      balances[legacyKey] = (balances[legacyKey] ?? 0) - amount
    }
  } else if (action.type === 'withdraw') {
    const srcKey = `pot:${action.source.id}`
    balances[srcKey] = (balances[srcKey] ?? 0) - amount
    balances[accountKey] = (balances[accountKey] ?? 0) + amount
  }
}

export async function dryRunAutomation(automationId, options = {}) {
  const vault = getVaultData()
  const automation = vault.automations.find((a) => a.id === automationId)
  if (!automation) throw new Error('Automation not found')

  const balances = await resolveAutomationBalances(
    automation,
    options.balances || null
  )

  const { met, details } = evaluateConditions(automation, balances)
  const transferAmount = met
    ? computeActionAmount(automation, balances, details)
    : 0

  return {
    automation,
    conditionsMet: met,
    conditionDetails: details,
    transferAmount,
    balances
  }
}

function recordAutomationRun(automationId, record) {
  updateVault((v) => {
    if (!v.automationRuns) v.automationRuns = {}
    v.automationRuns[automationId] = record
  })
}

function logAutomationActivity(automation, record) {
  appendAutomationActivity({
    at: record.at,
    source: record.source || 'manual',
    kind: 'automation',
    entityId: automation.id,
    name: automation.name,
    status: record.status,
    message: record.message,
    amount: record.amount
  })
}

function recordAutomationTriggerState(
  automationId,
  autoTrigger,
  runStatus,
  now = new Date()
) {
  const timezone = config.autoTriggerTimezone
  const vault = getVaultData()
  const prevState = vault.automationTriggerState?.[automationId]
  const nextState = buildTriggerStateRecord(
    autoTrigger,
    prevState,
    now,
    timezone,
    runStatus
  )

  updateVault((v) => {
    if (!v.automationTriggerState) v.automationTriggerState = {}
    v.automationTriggerState[automationId] = nextState
  })
}

export async function runAutomation(automationId, options = {}) {
  const source = options.source || 'manual'
  const vault = getVaultData()
  const automation = vault.automations.find((a) => a.id === automationId)
  if (!automation) throw new Error('Automation not found')
  if (!automation.enabled) throw new Error('Automation is disabled')

  const preview = await dryRunAutomation(automationId, {
    balances: options.balances || null
  })
  if (!preview.conditionsMet) {
    const runRecord = {
      at: new Date().toISOString(),
      status: 'skipped',
      message: 'Conditions not met',
      source
    }
    recordAutomationRun(automationId, runRecord)
    if (!options.fromGroup) {
      logAutomationActivity(automation, runRecord)
    }
    if (source === 'auto' && !options.fromGroup) {
      recordAutomationTriggerState(automationId, automation.autoTrigger, 'skipped')
    }
    return {
      status: 'skipped',
      message: runRecord.message,
      ...preview
    }
  }

  let amount = preview.transferAmount
  const { action } = automation
  const liveFunding = await resolveLiveFundingBalance(action)
  if (amount > liveFunding) {
    amount = liveFunding
  }

  if (amount <= 0) {
    const runRecord = {
      at: new Date().toISOString(),
      status: 'skipped',
      message:
        preview.transferAmount > 0
          ? 'Insufficient available balance for transfer'
          : 'Transfer amount is zero',
      source
    }
    recordAutomationRun(automationId, runRecord)
    if (!options.fromGroup) {
      logAutomationActivity(automation, runRecord)
    }
    return {
      status: 'skipped',
      message: runRecord.message,
      ...preview,
      transferAmount: amount
    }
  }

  const accountId = vault.monzo.accountId
  const now = new Date()
  const dedupeId = getTransferDedupeId(
    automationId,
    automation.autoTrigger,
    vault.automationTriggerState?.[automationId],
    now,
    config.autoTriggerTimezone,
    source
  )
  const transferAmount = Math.round(amount)
  try {
    let result
    if (action.type === 'deposit') {
      const potId = action.destination.id
      result = await depositToPot(potId, {
        sourceAccountId: accountId,
        amount: transferAmount,
        dedupeId
      })
    } else if (action.type === 'withdraw') {
      const potId = action.source.id
      result = await withdrawFromPot(potId, {
        destinationAccountId: accountId,
        amount: transferAmount,
        dedupeId
      })
    } else {
      throw new Error(`Unknown action type: ${action.type}`)
    }

    const runRecord = {
      at: new Date().toISOString(),
      status: 'success',
      amount: transferAmount,
      dedupeId,
      source
    }
    recordAutomationRun(automationId, runRecord)
    if (!options.fromGroup) {
      logAutomationActivity(automation, runRecord)
    }
    if (source === 'auto' && !options.fromGroup) {
      recordAutomationTriggerState(automationId, automation.autoTrigger, 'success', now)
    }

    return {
      status: 'success',
      amount: transferAmount,
      result,
      ...preview
    }
  } catch (err) {
    const runRecord = {
      at: new Date().toISOString(),
      status: 'error',
      message: err.message || 'Transfer failed',
      source
    }
    recordAutomationRun(automationId, runRecord)
    if (!options.fromGroup) {
      logAutomationActivity(automation, runRecord)
    }
    if (source === 'auto' && !options.fromGroup) {
      recordAutomationTriggerState(automationId, automation.autoTrigger, 'error', now)
    }
    return {
      status: 'error',
      message: err.message || 'Transfer failed',
      ...preview
    }
  }
}

export function listAutomations() {
  return getVaultData().automations
}

export function getAutomation(id) {
  return getVaultData().automations.find((a) => a.id === id)
}

export function createAutomation(data) {
  const automation = {
    id: uuidv4(),
    name: data.name || 'Untitled',
    enabled: data.enabled !== false,
    showOnDashboard: data.showOnDashboard !== false,
    conditions: data.conditions || [],
    conditionLogic: data.conditionLogic || 'all',
    action: data.action,
    autoTrigger: normalizeAutoTrigger(data.autoTrigger)
  }
  updateVault((v) => {
    v.automations.push(automation)
  })
  return automation
}

export function updateAutomation(id, data) {
  let updated = null
  updateVault((v) => {
    const idx = v.automations.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Automation not found')
    const patch = { ...data, id }
    if (data.autoTrigger !== undefined) {
      patch.autoTrigger = normalizeAutoTrigger(data.autoTrigger)
    }
    v.automations[idx] = { ...v.automations[idx], ...patch }
    updated = v.automations[idx]
  })
  return updated
}

export function deleteAutomation(id) {
  updateVault((v) => {
    v.automations = v.automations.filter((a) => a.id !== id)
    delete v.automationRuns[id]
    if (v.automationTriggerState) delete v.automationTriggerState[id]
    if (v.automationGroups) {
      v.automationGroups = v.automationGroups
        .map((g) => ({
          ...g,
          automationIds: (g.automationIds || []).filter((aid) => aid !== id)
        }))
        .filter((g) => g.automationIds.length > 0)
    }
  })
}
