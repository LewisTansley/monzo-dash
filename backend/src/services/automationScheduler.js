import { isHeadlessRunsEnabled } from './vault.js'
import { config } from '../config.js'
import {
  evaluateEligibleAutomations,
  evaluateEligibleGroups
} from './automationTriggers.js'
import { runAutomation } from './automationEngine.js'
import { runAutomationGroup } from './automationGroupEngine.js'

let intervalId = null
let ticking = false

export async function runAutoCheck() {
  if (!isHeadlessRunsEnabled()) {
    return { vaultLocked: true, groups: [], automations: [] }
  }

  const groupResults = []
  const automationResults = []

  const eligibleGroups = evaluateEligibleGroups()
  for (const group of eligibleGroups) {
    try {
      const result = await runAutomationGroup(group.id, { source: 'auto' })
      groupResults.push({
        id: group.id,
        name: group.name,
        status: result.status,
        message: result.message
      })
    } catch (err) {
      groupResults.push({
        id: group.id,
        name: group.name,
        status: 'error',
        message: err.message
      })
    }
  }

  const eligibleAutomations = evaluateEligibleAutomations()
  for (const automation of eligibleAutomations) {
    try {
      const result = await runAutomation(automation.id, { source: 'auto' })
      automationResults.push({
        id: automation.id,
        name: automation.name,
        status: result.status,
        message: result.message,
        amount: result.amount
      })
    } catch (err) {
      automationResults.push({
        id: automation.id,
        name: automation.name,
        status: 'error',
        message: err.message
      })
    }
  }

  return {
    vaultLocked: false,
    groups: groupResults,
    automations: automationResults
  }
}

async function tick() {
  if (!isHeadlessRunsEnabled() || ticking) return
  ticking = true
  try {
    await runAutoCheck()
  } catch (err) {
    console.error('Automation scheduler tick failed:', err.message)
  } finally {
    ticking = false
  }
}

export function startAutomationScheduler() {
  if (intervalId) return
  intervalId = setInterval(tick, config.autoTriggerIntervalMs)
  console.log(
    `Automation scheduler started (every ${config.autoTriggerIntervalMs}ms, timezone ${config.autoTriggerTimezone})`
  )
}

export function stopAutomationScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
