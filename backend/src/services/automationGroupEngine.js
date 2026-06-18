import { v4 as uuidv4 } from 'uuid'
import {
  dryRunAutomation,
  runAutomation,
  getAutomation,
  applyTransferToBalances
} from './automationEngine.js'
import { getVaultData, updateVault } from './vault.js'
import { buildTriggerStateRecord, normalizeAutoTrigger } from './automationTriggers.js'
import { config } from '../config.js'
import { appendAutomationActivity } from './automationActivity.js'

function validateAutomationIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('At least one automation is required')
  }
  const vault = getVaultData()
  for (const id of ids) {
    if (!vault.automations.find((a) => a.id === id)) {
      throw new Error(`Automation not found: ${id}`)
    }
  }
}

export function listAutomationGroups() {
  return getVaultData().automationGroups || []
}

export function getAutomationGroup(id) {
  return listAutomationGroups().find((g) => g.id === id)
}

export function createAutomationGroup(data) {
  const automationIds = data.automationIds || []
  validateAutomationIds(automationIds)

  const group = {
    id: uuidv4(),
    name: data.name || 'Untitled group',
    enabled: data.enabled !== false,
    showOnDashboard: data.showOnDashboard !== false,
    automationIds,
    autoTrigger: normalizeAutoTrigger(data.autoTrigger)
  }
  updateVault((v) => {
    if (!v.automationGroups) v.automationGroups = []
    v.automationGroups.push(group)
  })
  return group
}

export function updateAutomationGroup(id, data) {
  let updated = null
  updateVault((v) => {
    const idx = (v.automationGroups || []).findIndex((g) => g.id === id)
    if (idx === -1) throw new Error('Automation group not found')
    if (data.automationIds !== undefined) {
      validateAutomationIds(data.automationIds)
    }
    const patch = { ...data, id }
    if (data.autoTrigger !== undefined) {
      patch.autoTrigger = normalizeAutoTrigger(data.autoTrigger)
    }
    v.automationGroups[idx] = { ...v.automationGroups[idx], ...patch }
    updated = v.automationGroups[idx]
  })
  return updated
}

export function deleteAutomationGroup(id) {
  updateVault((v) => {
    v.automationGroups = (v.automationGroups || []).filter((g) => g.id !== id)
    if (v.automationGroupRuns) delete v.automationGroupRuns[id]
    if (v.automationGroupTriggerState) delete v.automationGroupTriggerState[id]
  })
}

function recordGroupTriggerState(groupId, autoTrigger, runStatus, now = new Date()) {
  const timezone = config.autoTriggerTimezone
  const vault = getVaultData()
  const prevState = vault.automationGroupTriggerState?.[groupId]
  const nextState = buildTriggerStateRecord(
    autoTrigger,
    prevState,
    now,
    timezone,
    runStatus
  )

  updateVault((v) => {
    if (!v.automationGroupTriggerState) v.automationGroupTriggerState = {}
    v.automationGroupTriggerState[groupId] = nextState
  })
}

export async function dryRunAutomationGroup(groupId) {
  const group = getAutomationGroup(groupId)
  if (!group) throw new Error('Automation group not found')

  const steps = []
  let totalTransferAmount = 0
  let simulatedBalances = null
  const accountId = getVaultData().monzo.accountId

  for (const automationId of group.automationIds || []) {
    const automation = getAutomation(automationId)
    if (!automation) {
      steps.push({
        automationId,
        name: 'Missing automation',
        conditionsMet: false,
        transferAmount: 0,
        skipped: true,
        message: 'Automation not found'
      })
      continue
    }
    if (!automation.enabled) {
      steps.push({
        automationId,
        name: automation.name,
        conditionsMet: false,
        transferAmount: 0,
        skipped: true,
        message: 'Automation is disabled'
      })
      continue
    }

    const preview = await dryRunAutomation(automationId, {
      balances: simulatedBalances
    })
    steps.push({
      automationId,
      name: automation.name,
      conditionsMet: preview.conditionsMet,
      transferAmount: preview.transferAmount,
      skipped: false,
      ...preview
    })
    if (preview.conditionsMet && preview.transferAmount > 0) {
      totalTransferAmount += preview.transferAmount
      if (!simulatedBalances) {
        simulatedBalances = { ...preview.balances }
      }
      applyTransferToBalances(
        automation.action,
        preview.transferAmount,
        simulatedBalances,
        accountId
      )
    }
  }

  return {
    group,
    steps,
    totalTransferAmount,
    anyWouldRun: steps.some((s) => s.conditionsMet && s.transferAmount > 0)
  }
}

export async function runAutomationGroup(groupId, options = {}) {
  const source = options.source || 'manual'
  const group = getAutomationGroup(groupId)
  if (!group) throw new Error('Automation group not found')
  if (!group.enabled) throw new Error('Automation group is disabled')

  const results = []

  for (const automationId of group.automationIds || []) {
    const automation = getAutomation(automationId)
    if (!automation) {
      results.push({
        automationId,
        status: 'skipped',
        message: 'Automation not found'
      })
      continue
    }
    if (!automation.enabled) {
      results.push({
        automationId,
        status: 'skipped',
        message: 'Automation is disabled'
      })
      continue
    }

    try {
      const result = await runAutomation(automationId, { source, fromGroup: true })
      results.push({
        automationId,
        status: result.status,
        amount: result.amount,
        message: result.message
      })
      if (result.status === 'error') {
        break
      }
    } catch (err) {
      results.push({
        automationId,
        status: 'error',
        message: err.message
      })
      break
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorResult = results.find((r) => r.status === 'error')

  const runRecord = {
    at: new Date().toISOString(),
    status: errorResult ? 'error' : successCount > 0 ? 'success' : 'skipped',
    results,
    source
  }

  updateVault((v) => {
    if (!v.automationGroupRuns) v.automationGroupRuns = {}
    v.automationGroupRuns[groupId] = runRecord
  })

  appendAutomationActivity({
    at: runRecord.at,
    source,
    kind: 'group',
    entityId: groupId,
    name: group.name,
    status: runRecord.status,
    message: errorResult
      ? errorResult.message
      : successCount > 0
        ? `Ran ${successCount} automation(s)${skippedCount ? `, ${skippedCount} skipped` : ''}`
        : 'No automations ran',
    results: runRecord.results
  })

  if (source === 'auto') {
    const runStatus = errorResult ? 'error' : successCount > 0 ? 'success' : 'skipped'
    recordGroupTriggerState(groupId, group.autoTrigger, runStatus)
  }

  return {
    status: errorResult ? 'error' : successCount > 0 ? 'success' : 'skipped',
    message: errorResult
      ? errorResult.message
      : successCount > 0
        ? `Ran ${successCount} automation(s)${skippedCount ? `, ${skippedCount} skipped` : ''}`
        : 'No automations ran',
    results,
    group
  }
}
