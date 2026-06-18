import { isHeadlessRunsEnabled } from './vault.js'
import { config } from '../config.js'
import {
  evaluateEligibleAutomations,
  evaluateEligibleGroups
} from './automationTriggers.js'
import { runAutomation } from './automationEngine.js'
import { runAutomationGroup } from './automationGroupEngine.js'

let intervalId = null
let schedulerState = { running: false, startedAt: null, current: null }

export function getSchedulerStatus() {
  return { ...schedulerState }
}

function resetSchedulerState() {
  schedulerState = { running: false, startedAt: null, current: null }
}

export async function runAutoCheck() {
  if (!isHeadlessRunsEnabled()) {
    return { vaultLocked: true, groups: [], automations: [] }
  }

  if (schedulerState.running) {
    return { vaultLocked: false, groups: [], automations: [], alreadyRunning: true }
  }

  schedulerState = {
    running: true,
    startedAt: new Date().toISOString(),
    current: null
  }

  const groupResults = []
  const automationResults = []

  try {
    const eligibleGroups = evaluateEligibleGroups()
    for (const group of eligibleGroups) {
      schedulerState.current = { kind: 'group', id: group.id, name: group.name }
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
      schedulerState.current = {
        kind: 'automation',
        id: automation.id,
        name: automation.name
      }
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
  } finally {
    resetSchedulerState()
  }
}

async function tick() {
  if (!isHeadlessRunsEnabled() || schedulerState.running) return
  try {
    await runAutoCheck()
  } catch (err) {
    console.error('Automation scheduler tick failed:', err.message)
    resetSchedulerState()
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
