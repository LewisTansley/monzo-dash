import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  getVaultData,
  updateVault,
  syncHeadlessSession,
  headlessSessionStored,
  migrateVaultSettings,
  normalizeFrontendInactivityTimeout,
  FRONTEND_INACTIVITY_TIMEOUT_OPTIONS
} from '../services/vault.js'

const router = Router()

function settingsResponse() {
  const vault = getVaultData()
  return {
    settings: migrateVaultSettings(vault.settings),
    headlessSessionStored: headlessSessionStored()
  }
}

router.get('/', requireVault, (_req, res) => {
  try {
    res.json(settingsResponse())
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.put('/', requireVault, (req, res) => {
  try {
    const { settings } = req.body || {}
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object is required' })
    }

    if (
      Object.prototype.hasOwnProperty.call(settings, 'frontendInactivityTimeoutMinutes') &&
      settings.frontendInactivityTimeoutMinutes !== null &&
      settings.frontendInactivityTimeoutMinutes !== undefined &&
      settings.frontendInactivityTimeoutMinutes !== ''
    ) {
      const normalized = normalizeFrontendInactivityTimeout(
        settings.frontendInactivityTimeoutMinutes
      )
      if (normalized === null) {
        return res.status(400).json({
          error: `frontendInactivityTimeoutMinutes must be one of: never, ${FRONTEND_INACTIVITY_TIMEOUT_OPTIONS.join(', ')}`
        })
      }
      settings.frontendInactivityTimeoutMinutes = normalized
    } else if (
      Object.prototype.hasOwnProperty.call(settings, 'frontendInactivityTimeoutMinutes')
    ) {
      settings.frontendInactivityTimeoutMinutes = null
    }

    updateVault((v) => {
      v.settings = migrateVaultSettings({
        ...v.settings,
        ...settings
      })
    })
    syncHeadlessSession()

    res.json(settingsResponse())
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
