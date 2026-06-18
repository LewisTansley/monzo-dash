import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  defaultVaultSettings,
  getVaultData,
  updateVault,
  syncHeadlessSession,
  headlessSessionStored,
  migrateVaultSettings
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
