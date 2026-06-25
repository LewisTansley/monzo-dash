import fs from 'fs'
import path from 'path'
import { config } from '../config.js'
import { encryptJson, decryptJson } from './vaultCrypto.js'
import { getVaultData, getSessionPassphrase } from './vault.js'
import { deduplicateTransactionsById } from './transactionUtils.js'

const SYNC_STATE_FILE = 'sync-state.enc'
const MONTH_FILE_PATTERN = /^(\d{4}-\d{2})\.enc$/

function cacheDir() {
  return path.join(path.dirname(config.vaultPath), 'transactions')
}

function requirePassphrase() {
  const passphrase = getSessionPassphrase()
  if (!passphrase) {
    throw new Error('Vault is locked')
  }
  return passphrase
}

function ensureCacheDir() {
  fs.mkdirSync(cacheDir(), { recursive: true })
}

function monthFilePath(monthKey) {
  return path.join(cacheDir(), `${monthKey}.enc`)
}

function syncStatePath() {
  return path.join(cacheDir(), SYNC_STATE_FILE)
}

function readEncryptedFile(filePath) {
  if (!fs.existsSync(filePath)) return null
  const passphrase = requirePassphrase()
  const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return decryptJson(envelope, passphrase)
}

function writeEncryptedFile(filePath, payload) {
  ensureCacheDir()
  const passphrase = requirePassphrase()
  const envelope = encryptJson(payload, passphrase)
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8')
}

export function defaultSyncState() {
  return {
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    monthsSynced: 0,
    oldestMonth: null,
    lastError: null,
    stoppedReason: null,
    syncRangeStart: null,
    syncRangeEnd: null,
    accountId: null,
    trigger: null
  }
}

export function getSyncState() {
  const stored = readEncryptedFile(syncStatePath())
  return { ...defaultSyncState(), ...(stored || {}) }
}

export function updateSyncState(patch) {
  const next = { ...getSyncState(), ...patch }
  writeEncryptedFile(syncStatePath(), next)
  return next
}

export function hasMonth(monthKey) {
  return fs.existsSync(monthFilePath(monthKey))
}

export function getMonth(monthKey) {
  return readEncryptedFile(monthFilePath(monthKey))
}

export function listCachedMonths() {
  const dir = cacheDir()
  if (!fs.existsSync(dir)) return []

  const months = fs
    .readdirSync(dir)
    .map((name) => {
      const match = MONTH_FILE_PATTERN.exec(name)
      return match ? match[1] : null
    })
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))

  return months
}

export function upsertMonth(monthKey, transactions) {
  const accountId = getVaultData().monzo.accountId
  const existing = getMonth(monthKey)
  const merged = deduplicateTransactionsById([
    ...(existing?.transactions || []),
    ...transactions
  ])

  const payload = {
    month: monthKey,
    accountId,
    syncedAt: new Date().toISOString(),
    transactions: merged
  }

  writeEncryptedFile(monthFilePath(monthKey), payload)
  return payload
}

export function getCacheSummary() {
  const months = listCachedMonths()
  return {
    cachedMonthCount: months.length,
    oldestCachedMonth: months.length ? months[months.length - 1] : null,
    newestCachedMonth: months.length ? months[0] : null
  }
}
