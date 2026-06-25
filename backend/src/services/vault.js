import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config } from '../config.js'
import { encryptJson, decryptJson } from './vaultCrypto.js'

let sessionPassphrase = null
let sessionData = null

function migrateBudgetData(vault) {
  let migrated = false

  if (!vault.budget && vault.homeBudget) {
    vault.budget = { items: [...(vault.homeBudget.items || [])] }
    delete vault.homeBudget
    migrated = true
  }
  if (!vault.budget) {
    vault.budget = { items: [] }
    migrated = true
  }
  if (!vault.budget.items) {
    vault.budget.items = []
    migrated = true
  }

  return migrated
}

export const FRONTEND_INACTIVITY_TIMEOUT_OPTIONS = [1, 3, 5, 10, 15]

export function defaultVaultSettings() {
  return {
    allowHeadlessRuns: false,
    frontendInactivityTimeoutMinutes: null
  }
}

export function normalizeFrontendInactivityTimeout(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || !FRONTEND_INACTIVITY_TIMEOUT_OPTIONS.includes(minutes)) {
    return null
  }
  return minutes
}

export function migrateVaultSettings(settings = {}) {
  const next = { ...defaultVaultSettings(), ...settings }
  if (
    next.allowHeadlessRuns === false &&
    settings.autoUnlockOnStartup === true
  ) {
    next.allowHeadlessRuns = true
  }
  delete next.autoUnlockOnStartup
  next.frontendInactivityTimeoutMinutes = normalizeFrontendInactivityTimeout(
    next.frontendInactivityTimeoutMinutes
  )
  return next
}

function vaultDir() {
  return path.dirname(config.vaultPath)
}

function headlessKeyPath() {
  return path.join(vaultDir(), 'headless.key')
}

function headlessSessionPath() {
  return path.join(vaultDir(), 'headless-session.enc')
}

function readOrCreateHeadlessKey() {
  const keyPath = headlessKeyPath()
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath)
    if (key.length === 32) return key
  }
  const dir = vaultDir()
  fs.mkdirSync(dir, { recursive: true })
  const key = crypto.randomBytes(32)
  fs.writeFileSync(keyPath, key)
  return key
}

function encryptHeadlessPassphrase(passphrase) {
  const key = readOrCreateHeadlessKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(passphrase, 'utf8')),
    cipher.final()
  ])
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64')
  }
}

function decryptHeadlessPassphrase(envelope) {
  const key = readOrCreateHeadlessKey()
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

export function headlessSessionStored() {
  return fs.existsSync(headlessSessionPath())
}

export function clearHeadlessSession() {
  if (fs.existsSync(headlessSessionPath())) {
    fs.unlinkSync(headlessSessionPath())
  }
}

export function persistHeadlessSession(passphrase = sessionPassphrase) {
  if (!passphrase) return
  const dir = vaultDir()
  fs.mkdirSync(dir, { recursive: true })
  const envelope = encryptHeadlessPassphrase(passphrase)
  fs.writeFileSync(headlessSessionPath(), JSON.stringify(envelope, null, 2), 'utf8')
}

export function syncHeadlessSession() {
  if (!isUnlocked()) {
    clearHeadlessSession()
    return
  }
  const settings = migrateVaultSettings(getVaultData().settings)
  if (settings.allowHeadlessRuns) {
    persistHeadlessSession()
  } else {
    clearHeadlessSession()
  }
}

export function isHeadlessRunsEnabled() {
  if (!isUnlocked()) return false
  return migrateVaultSettings(getVaultData().settings).allowHeadlessRuns === true
}

export function tryRestoreHeadlessSession() {
  if (!vaultExists() || isUnlocked() || !headlessSessionStored()) {
    return false
  }

  try {
    const raw = fs.readFileSync(headlessSessionPath(), 'utf8')
    const envelope = JSON.parse(raw)
    const passphrase = decryptHeadlessPassphrase(envelope)
    unlockVault(passphrase)
    if (!isHeadlessRunsEnabled()) {
      lockVault()
      clearHeadlessSession()
      return false
    }
    return true
  } catch {
    clearHeadlessSession()
    return false
  }
}

export function defaultVaultPayload() {
  return {
    monzo: {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      accountId: '',
      userId: '',
      accountCreatedAt: '',
      historyStartMonth: ''
    },
    settings: defaultVaultSettings(),
    automations: [],
    automationGroups: [],
    budgets: {},
    automationRuns: {},
    automationGroupRuns: {},
    automationTriggerState: {},
    automationGroupTriggerState: {},
    automationActivityLog: [],
    budget: { items: [] },
    forecast: { savingsPotId: null }
  }
}

function encryptPayload(payload, passphrase) {
  return encryptJson(payload, passphrase)
}

function decryptEnvelope(envelope, passphrase) {
  return decryptJson(envelope, passphrase)
}

export function getSessionPassphrase() {
  return sessionPassphrase
}

export function vaultExists() {
  return fs.existsSync(config.vaultPath)
}

export function isUnlocked() {
  return sessionData !== null
}

export function getVaultData() {
  if (!sessionData) {
    throw new Error('Vault is locked')
  }
  return sessionData
}

export function initVault(passphrase, initialPayload = null) {
  if (vaultExists()) {
    throw new Error('Vault already exists')
  }
  const dir = path.dirname(config.vaultPath)
  fs.mkdirSync(dir, { recursive: true })
  const payload = initialPayload || defaultVaultPayload()
  const envelope = encryptPayload(payload, passphrase)
  fs.writeFileSync(config.vaultPath, JSON.stringify(envelope, null, 2), 'utf8')
  sessionPassphrase = passphrase
  sessionData = payload
  return { initialized: true }
}

export function unlockVault(passphrase) {
  if (!vaultExists()) {
    throw new Error('Vault does not exist')
  }
  const raw = fs.readFileSync(config.vaultPath, 'utf8')
  const envelope = JSON.parse(raw)
  const payload = decryptEnvelope(envelope, passphrase)
  sessionPassphrase = passphrase
  const defaults = defaultVaultPayload()
  sessionData = {
    ...defaults,
    ...payload,
    monzo: { ...defaults.monzo, ...(payload.monzo || {}) },
    settings: migrateVaultSettings(payload.settings || {}),
    budgets: payload.budgets || defaults.budgets,
    forecast: { ...defaults.forecast, ...(payload.forecast || {}) },
    automationRuns: payload.automationRuns || defaults.automationRuns,
    automationGroupRuns: payload.automationGroupRuns || defaults.automationGroupRuns,
    automationTriggerState:
      payload.automationTriggerState || defaults.automationTriggerState,
    automationGroupTriggerState:
      payload.automationGroupTriggerState || defaults.automationGroupTriggerState,
    automationActivityLog:
      payload.automationActivityLog || defaults.automationActivityLog,
    budget: payload.budget || payload.homeBudget || defaults.budget
  }
  if (!sessionData.automations) sessionData.automations = []
  if (!sessionData.automationGroups) sessionData.automationGroups = []
  if (!sessionData.automationGroupRuns) sessionData.automationGroupRuns = {}
  if (!sessionData.automationTriggerState) sessionData.automationTriggerState = {}
  if (!sessionData.automationGroupTriggerState) {
    sessionData.automationGroupTriggerState = {}
  }
  if (!sessionData.automationActivityLog) sessionData.automationActivityLog = []
  if (migrateBudgetData(sessionData)) {
    saveVault()
  }
  queueMicrotask(() => {
    import('./historicalSync.js')
      .then(({ maybeStartHistoricalSyncOnUnlock }) => maybeStartHistoricalSyncOnUnlock())
      .catch(() => {})
  })
  return { unlocked: true }
}

export function verifyPassphrase(passphrase) {
  if (!vaultExists()) {
    throw new Error('Vault does not exist')
  }
  if (!passphrase) {
    throw new Error('Passphrase required')
  }
  const raw = fs.readFileSync(config.vaultPath, 'utf8')
  const envelope = JSON.parse(raw)
  decryptEnvelope(envelope, passphrase)
  return { ok: true }
}

export function lockVault() {
  sessionPassphrase = null
  sessionData = null
  clearHeadlessSession()
}

export function saveVault() {
  if (!sessionData || !sessionPassphrase) {
    throw new Error('Vault is locked')
  }
  const dir = path.dirname(config.vaultPath)
  fs.mkdirSync(dir, { recursive: true })
  const envelope = encryptPayload(sessionData, sessionPassphrase)
  fs.writeFileSync(config.vaultPath, JSON.stringify(envelope, null, 2), 'utf8')
}

export function updateVault(mutator) {
  if (!sessionData) throw new Error('Vault is locked')
  mutator(sessionData)
  saveVault()
  return sessionData
}

export function getVaultStatus() {
  const settings = sessionData ? migrateVaultSettings(sessionData.settings) : null
  return {
    exists: vaultExists(),
    unlocked: isUnlocked(),
    allowHeadlessRuns: settings?.allowHeadlessRuns === true,
    frontendInactivityTimeoutMinutes:
      settings?.frontendInactivityTimeoutMinutes ?? null,
    headlessSessionStored: headlessSessionStored(),
    hasMonzoCredentials: Boolean(
      sessionData?.monzo?.clientId?.trim() &&
        sessionData?.monzo?.clientSecret?.trim()
    ),
    hasMonzoTokens: Boolean(sessionData?.monzo?.refreshToken?.trim()),
    isMonzoConnected: Boolean(
      sessionData?.monzo?.refreshToken?.trim() &&
        sessionData?.monzo?.accountId?.trim()
    )
  }
}
