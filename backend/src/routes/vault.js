import { Router } from 'express'
import { config } from '../config.js'
import {
  vaultExists,
  initVault,
  unlockVault,
  lockVault,
  getVaultStatus,
  updateVault,
  getVaultData
} from '../services/vault.js'
import { validateMonzoClientId } from '../services/monzoClient.js'

const router = Router()

router.get('/status', (_req, res) => {
  const status = getVaultStatus()
  try {
    if (status.unlocked) {
      const { monzo } = getVaultData()
      status.accountId = monzo.accountId || ''
    }
  } catch {
    // ignore
  }
  res.json(status)
})

router.post('/init', (req, res) => {
  try {
    const { passphrase } = req.body
    if (!passphrase || passphrase.length < 8) {
      return res.status(400).json({ error: 'Passphrase must be at least 8 characters' })
    }
    if (vaultExists()) {
      return res.status(400).json({ error: 'Vault already exists' })
    }
    initVault(passphrase)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/unlock', (req, res) => {
  try {
    const { passphrase } = req.body
    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase required' })
    }
    unlockVault(passphrase)
    res.json({ ok: true, ...getVaultStatus() })
  } catch (err) {
    res.status(401).json({ error: 'Invalid passphrase' })
  }
})

router.post('/lock', (_req, res) => {
  lockVault()
  res.json({ ok: true })
})

router.get('/monzo-setup', (_req, res) => {
  res.json({
    redirectUri: config.monzoRedirectUri,
    clientIdHint: 'oauth2client_… from developers.monzo.com (not your user_… ID)'
  })
})

router.put('/monzo-credentials', (req, res) => {
  try {
    const { clientId, clientSecret } = req.body
    const existing = getVaultData()
    const hadSecret = Boolean(existing.monzo.clientSecret?.trim())

    const trimmedId = typeof clientId === 'string' ? clientId.trim() : ''
    const secretInBody = Object.prototype.hasOwnProperty.call(req.body, 'clientSecret')
    const trimmedSecret =
      typeof clientSecret === 'string' ? clientSecret.trim() : ''

    if (!trimmedId) {
      return res.status(400).json({ error: 'Client ID is required' })
    }

    const idErr = validateMonzoClientId(trimmedId)
    if (idErr) return res.status(400).json({ error: idErr })

    if (!hadSecret && !trimmedSecret) {
      return res.status(400).json({
        error: 'Client secret is required. Paste it from developers.monzo.com.'
      })
    }

    if (secretInBody && !trimmedSecret) {
      return res.status(400).json({
        error:
          'Client secret cannot be empty. Leave the field blank to keep your saved secret.'
      })
    }

    updateVault((v) => {
      v.monzo.clientId = trimmedId
      if (trimmedSecret) {
        v.monzo.clientSecret = trimmedSecret
      }
    })

    const { monzo } = getVaultData()
    res.json({
      ok: true,
      hasClientSecret: Boolean(monzo.clientSecret?.trim())
    })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.get('/monzo-credentials', (_req, res) => {
  try {
    const { monzo } = getVaultData()
    res.json({
      clientId: monzo.clientId,
      hasClientSecret: Boolean(monzo.clientSecret?.trim())
    })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

export default router
