import { Router } from 'express'
import crypto from 'crypto'
import { config } from '../config.js'
import { requireVault } from '../middleware/vaultGuard.js'
import { buildAuthUrl, exchangeAuthCode } from '../services/monzoClient.js'
import { getVaultStatus, isUnlocked } from '../services/vault.js'
import { registerOAuthState, consumeOAuthState } from '../services/oauthState.js'

const router = Router()

router.get('/monzo/url', requireVault, (req, res) => {
  try {
    const status = getVaultStatus()
    if (!status.hasMonzoCredentials) {
      return res.status(400).json({
        error:
          'Save both client ID and client secret in Settings before connecting.'
      })
    }
    const state = crypto.randomBytes(16).toString('hex')
    registerOAuthState(state)
    res.json({ url: buildAuthUrl(state), state })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/monzo/callback', async (req, res) => {
  const { code, state, error } = req.query
  if (error) {
    return res.redirect(`${config.frontendUrl}/settings?error=${encodeURIComponent(error)}`)
  }
  if (!code || !state || !consumeOAuthState(state)) {
    return res.redirect(
      `${config.frontendUrl}/settings?error=${encodeURIComponent(
        'OAuth session expired. Unlock your vault, then click Connect Monzo again (keep the backend running).'
      )}`
    )
  }

  if (!isUnlocked()) {
    return res.redirect(
      `${config.frontendUrl}/settings?error=${encodeURIComponent(
        'Vault was locked during sign-in. Unlock your vault on Settings, then click Connect Monzo again.'
      )}`
    )
  }

  try {
    const result = await exchangeAuthCode(code)
    const q = result.fullyLinked ? 'connected=1' : 'connected=pending'
    res.redirect(`${config.frontendUrl}/settings?${q}`)
  } catch (err) {
    const hint =
      err.message?.includes('authenticate') || err.message?.includes('invalid')
        ? `${err.message}. Check your client secret in Settings and save again.`
        : err.message
    res.redirect(
      `${config.frontendUrl}/settings?error=${encodeURIComponent(hint)}`
    )
  }
})

export default router
