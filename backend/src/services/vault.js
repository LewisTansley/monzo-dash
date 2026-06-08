import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config } from '../config.js'

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const VAULT_VERSION = 1

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

export function defaultVaultPayload() {
  return {
    monzo: {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      accountId: '',
      userId: ''
    },
    automations: [],
    automationGroups: [],
    budgets: {},
    automationRuns: {},
    automationGroupRuns: {},
    budget: { items: [] }
  }
}

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32, SCRYPT_OPTIONS)
}

function encryptPayload(payload, passphrase) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    version: VAULT_VERSION,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  }
}

function decryptEnvelope(envelope, passphrase) {
  const salt = Buffer.from(envelope.salt, 'base64')
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64')
  const key = deriveKey(passphrase, salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
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
    budgets: payload.budgets || defaults.budgets,
    automationRuns: payload.automationRuns || defaults.automationRuns,
    automationGroupRuns: payload.automationGroupRuns || defaults.automationGroupRuns,
    budget: payload.budget || payload.homeBudget || defaults.budget
  }
  if (!sessionData.automations) sessionData.automations = []
  if (!sessionData.automationGroups) sessionData.automationGroups = []
  if (!sessionData.automationGroupRuns) sessionData.automationGroupRuns = {}
  if (migrateBudgetData(sessionData)) {
    saveVault()
  }
  return { unlocked: true }
}

export function lockVault() {
  sessionPassphrase = null
  sessionData = null
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
  return {
    exists: vaultExists(),
    unlocked: isUnlocked(),
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
