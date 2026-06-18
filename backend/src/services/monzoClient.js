import { config } from '../config.js'
import { annotatePotTransfers } from './potTransfers.js'
import { deduplicateTransactionsById } from './transactionUtils.js'
import { getVaultData, updateVault } from './vault.js'

function monzoErrorMessage(data, status) {
  return (
    data?.error_description ||
    data?.message ||
    data?.error ||
    `Monzo API error ${status}`
  )
}

function isWaitingForApproval(err) {
  if (err?.code === 'WAITING_APPROVAL') return true
  if (err?.status === 403 || err?.status === 401) return true
  const msg = String(err?.message || '')
  return /not yet|approve|authenticated|forbidden|permission|waiting/i.test(msg)
}

export function isVerificationRequired(err) {
  if (err?.code === 'VERIFICATION_REQUIRED') return true
  const msg = String(err?.message || '')
  const code = String(err?.data?.code || err?.data?.error || '')
  return /verification.?required/i.test(msg) || /verification.?required/i.test(code)
}

async function monzoFormRequest(path, body, accessToken) {
  const params = new URLSearchParams(body)
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  const res = await fetch(`${config.monzoApiBase}${path}`, {
    method: 'POST',
    headers,
    body: params.toString()
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(monzoErrorMessage(data, res.status))
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

async function monzoGet(path, accessToken, query = {}) {
  const qs = new URLSearchParams(query)
  const url = `${config.monzoApiBase}${path}${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(monzoErrorMessage(data, res.status))
    err.status = res.status
    err.data = data
    if (isVerificationRequired(err)) err.code = 'VERIFICATION_REQUIRED'
    throw err
  }
  return data
}

async function monzoPut(path, body, accessToken) {
  const params = new URLSearchParams(body)
  const res = await fetch(`${config.monzoApiBase}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(monzoErrorMessage(data, res.status))
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function waitingApprovalError(message) {
  const err = new Error(message)
  err.code = 'WAITING_APPROVAL'
  return err
}

export async function refreshAccessToken() {
  const vault = getVaultData()
  const { clientId, clientSecret, refreshToken } = vault.monzo
  if (!refreshToken) throw new Error('Not connected to Monzo')

  const data = await monzoFormRequest('/oauth2/token', {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  })

  updateVault((v) => {
    v.monzo.accessToken = data.access_token
    if (data.refresh_token) v.monzo.refreshToken = data.refresh_token
    v.monzo.expiresAt = Date.now() + (data.expires_in || 21600) * 1000
  })

  return data.access_token
}

export async function getAccessToken({ allowRefresh = true } = {}) {
  const vault = getVaultData()
  const { accessToken, expiresAt } = vault.monzo
  if (!vault.monzo.refreshToken?.trim()) {
    throw new Error('Not connected to Monzo')
  }
  if (
    allowRefresh &&
    (!accessToken?.trim() || Date.now() > expiresAt - 60_000)
  ) {
    return refreshAccessToken()
  }
  if (!accessToken?.trim()) {
    return refreshAccessToken()
  }
  return accessToken
}

const OAUTH_CLIENT_ID_PREFIX = /^oauth2?client_/

export function validateMonzoClientId(clientId) {
  if (!clientId) return 'Monzo client ID is required'
  if (clientId.startsWith('user_')) {
    return 'That looks like a Monzo user ID, not an OAuth client ID. Use the Client ID from developers.monzo.com (oauth2client_…)'
  }
  if (!OAUTH_CLIENT_ID_PREFIX.test(clientId)) {
    return 'OAuth client ID should start with oauth2client_ (from developers.monzo.com → your app → Client ID)'
  }
  return null
}

export function validateRedirectUri(uri) {
  if (/127\.0\.0\.1|:\/\/\d+\.\d+\.\d+\.\d+/.test(uri)) {
    return 'Monzo blocks IP addresses in redirect URIs. Use http://localhost:3001/api/auth/monzo/callback instead of 127.0.0.1'
  }
  return null
}

export function buildAuthUrl(state) {
  const vault = getVaultData()
  const { clientId } = vault.monzo
  const clientErr = validateMonzoClientId(clientId)
  if (clientErr) throw new Error(clientErr)
  const redirectErr = validateRedirectUri(config.monzoRedirectUri)
  if (redirectErr) throw new Error(redirectErr)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: config.monzoRedirectUri,
    response_type: 'code',
    state
  })
  return `https://auth.monzo.com/?${params}`
}

function pickAccountId(accountsList) {
  const preferred = ['uk_retail', 'uk_retail_joint']
  for (const type of preferred) {
    const acc = accountsList.find((a) => a.type === type)
    if (acc) return { id: acc.id, type: acc.type }
  }
  if (accountsList[0]) {
    return { id: accountsList[0].id, type: accountsList[0].type }
  }
  return null
}

async function fetchRetailAccountId(accessToken) {
  let whoami
  try {
    whoami = await monzoGet('/ping/whoami', accessToken)
  } catch (err) {
    if (isWaitingForApproval(err)) {
      throw waitingApprovalError(
        'Open the Monzo app on your phone and tap Approve for this connection.'
      )
    }
    throw err
  }

  if (whoami.authenticated === false) {
    throw waitingApprovalError(
      'Open the Monzo app on your phone and tap Approve for this connection.'
    )
  }

  const accounts = await monzoGet('/accounts', accessToken)
  const list = accounts.accounts || []

  if (!list.length) {
    throw waitingApprovalError(
      'No accounts visible yet. Approve access in the Monzo app, then try again.'
    )
  }

  const picked = pickAccountId(list)
  if (!picked) {
    throw new Error('No usable Monzo account found')
  }
  return picked
}

/** Diagnostic info for Settings UI (no secrets). */
export async function diagnoseMonzoConnection() {
  const vault = getVaultData()
  const result = {
    hasRefreshToken: Boolean(vault.monzo.refreshToken?.trim()),
    hasAccountId: Boolean(vault.monzo.accountId?.trim()),
    whoami: null,
    accountTypes: [],
    lastError: null
  }

  if (!result.hasRefreshToken) {
    result.lastError = 'No OAuth tokens saved. Click Connect Monzo first.'
    return result
  }

  try {
    const token = await getAccessToken({ allowRefresh: false })
    result.whoami = await monzoGet('/ping/whoami', token)
    if (result.whoami.authenticated === false) {
      result.lastError =
        'Token exists but not approved yet — open Monzo app and tap Approve.'
      return result
    }
    const accounts = await monzoGet('/accounts', token)
    result.accountTypes = (accounts.accounts || []).map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description
    }))
    if (!result.accountTypes.length) {
      result.lastError =
        'Approved token but no accounts returned yet. Wait a moment and retry.'
    }
  } catch (err) {
    result.lastError = err.message
    if (isWaitingForApproval(err)) {
      result.lastError =
        'Waiting for approval in the Monzo app. Open the app and tap Approve.'
    }
  }

  return result
}

/** Link account after OAuth; retries while user approves in the Monzo app. */
export async function ensureMonzoAccountLinked({
  maxAttempts = 36,
  delayMs = 5000
} = {}) {
  const vault = getVaultData()
  if (vault.monzo.accountId?.trim()) {
    return vault.monzo.accountId
  }
  if (!vault.monzo.refreshToken?.trim()) {
    throw new Error('Not connected to Monzo. Click Connect Monzo first.')
  }

  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const token = await getAccessToken({ allowRefresh: false })
      const picked = await fetchRetailAccountId(token)
      updateVault((v) => {
        v.monzo.accountId = picked.id
      })
      return picked.id
    } catch (err) {
      lastError = err
      if (!isWaitingForApproval(err) || attempt === maxAttempts - 1) {
        throw err
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  throw lastError || new Error('Timed out waiting for Monzo app approval')
}

export async function exchangeAuthCode(code) {
  const vault = getVaultData()
  const { clientId, clientSecret } = vault.monzo
  const data = await monzoFormRequest('/oauth2/token', {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: config.monzoRedirectUri,
    code
  })

  if (!data.refresh_token) {
    throw new Error(
      'Monzo did not issue a refresh token. Ensure your OAuth client is Confidential.'
    )
  }

  updateVault((v) => {
    v.monzo.accessToken = data.access_token
    v.monzo.refreshToken = data.refresh_token
    v.monzo.expiresAt = Date.now() + (data.expires_in || 21600) * 1000
    v.monzo.userId = data.user_id
  })

  try {
    const accountId = await ensureMonzoAccountLinked({
      maxAttempts: 18,
      delayMs: 5000
    })
    return { accountId, userId: data.user_id, fullyLinked: true }
  } catch (err) {
    return {
      accountId: '',
      userId: data.user_id,
      fullyLinked: false,
      pendingReason: err.message
    }
  }
}

export async function getBalance(accountId) {
  const token = await getAccessToken()
  const id = accountId || getVaultData().monzo.accountId
  return monzoGet('/balance', token, { account_id: id })
}

export async function getPots(currentAccountId) {
  const token = await getAccessToken()
  const id = currentAccountId || getVaultData().monzo.accountId
  return monzoGet('/pots', token, { current_account_id: id })
}

export async function getTransactions({ accountId, since, before, limit = 100 } = {}) {
  const token = await getAccessToken()
  const id = accountId || getVaultData().monzo.accountId
  const query = { account_id: id, limit: String(limit) }
  if (since) query.since = since
  if (before) query.before = before
  return monzoGet('/transactions', token, query)
}

const FEED_VERIFICATION_MESSAGE =
  'Older transactions require approval in the Monzo app.'

function sortTransactionsDesc(transactions) {
  return [...transactions].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  )
}

function currentMonthKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null
  return { year, month }
}

function formatMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  })
}

function previousMonthKey(year, month) {
  if (month === 0) return formatMonthKey(year - 1, 11)
  return formatMonthKey(year, month - 1)
}

function isCurrentMonth(year, month) {
  const now = new Date()
  return year === now.getFullYear() && month === now.getMonth()
}

/** Fetch all transactions in a calendar month (newest first). */
export async function fetchTransactionsForMonth(accountId, year, month) {
  const id = accountId || getVaultData().monzo.accountId
  const since = new Date(year, month, 1).toISOString()
  const sinceTime = new Date(since).getTime()
  const rangeBefore = isCurrentMonth(year, month)
    ? null
    : new Date(year, month + 1, 1).toISOString()

  const all = []
  let pageBefore = rangeBefore

  for (let page = 0; page < 50; page++) {
    const opts = { accountId: id, since, limit: 100 }
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

  return sortTransactionsDesc(
    deduplicateTransactionsById(
      all.filter((tx) => new Date(tx.created).getTime() >= sinceTime)
    )
  )
}

/** Month-at-a-time feed for sidebar UI (newest month first, scroll loads older months). */
export async function getTransactionMonthFeed({ accountId, month = null } = {}) {
  const monthKey = month || currentMonthKey()
  const parsed = parseMonthKey(monthKey)
  if (!parsed) {
    throw new Error('Invalid month; expected YYYY-MM')
  }

  const { year, month: monthIndex } = parsed

  try {
    const id = accountId || getVaultData().monzo.accountId
    const [transactions, potsRes] = await Promise.all([
      fetchTransactionsForMonth(accountId, year, monthIndex),
      getPots(id).catch(() => ({ pots: [] }))
    ])
    const annotated = annotatePotTransfers(transactions, potsRes.pots || [])
    const nextMonth = previousMonthKey(year, monthIndex)

    return {
      month: monthKey,
      monthLabel: formatMonthLabel(year, monthIndex),
      transactions: annotated,
      hasMore: Boolean(nextMonth),
      nextMonth,
      verificationRequired: false,
      message: null
    }
  } catch (err) {
    if (isVerificationRequired(err)) {
      return {
        month: monthKey,
        monthLabel: formatMonthLabel(year, monthIndex),
        transactions: [],
        hasMore: false,
        nextMonth: null,
        verificationRequired: true,
        message: FEED_VERIFICATION_MESSAGE
      }
    }
    throw err
  }
}

export async function depositToPot(potId, { sourceAccountId, amount, dedupeId }) {
  const token = await getAccessToken()
  return monzoPut(`/pots/${potId}/deposit`, {
    source_account_id: sourceAccountId || getVaultData().monzo.accountId,
    amount: String(amount),
    dedupe_id: dedupeId
  }, token)
}

export async function withdrawFromPot(potId, { destinationAccountId, amount, dedupeId }) {
  const token = await getAccessToken()
  return monzoPut(`/pots/${potId}/withdraw`, {
    destination_account_id: destinationAccountId || getVaultData().monzo.accountId,
    amount: String(amount),
    dedupe_id: dedupeId
  }, token)
}
