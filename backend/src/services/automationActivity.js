import crypto from 'crypto'
import { getVaultData, updateVault } from './vault.js'

const ACTIVITY_LOG_CAP = 50

export function appendAutomationActivity(entry) {
  const record = {
    id: crypto.randomUUID(),
    at: entry.at || new Date().toISOString(),
    source: entry.source || 'manual',
    kind: entry.kind,
    entityId: entry.entityId,
    name: entry.name,
    status: entry.status,
    ...(entry.message != null ? { message: entry.message } : {}),
    ...(entry.amount != null ? { amount: entry.amount } : {}),
    ...(entry.results?.length ? { results: entry.results } : {})
  }

  updateVault((v) => {
    if (!v.automationActivityLog) v.automationActivityLog = []
    v.automationActivityLog = [record, ...v.automationActivityLog].slice(0, ACTIVITY_LOG_CAP)
  })

  return record
}

export function listAutomationActivity(limit = ACTIVITY_LOG_CAP) {
  const vault = getVaultData()
  const log = vault.automationActivityLog || []
  return log.slice(0, Math.max(1, Math.min(limit, ACTIVITY_LOG_CAP)))
}
