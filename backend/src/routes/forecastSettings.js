import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import { getVaultData, updateVault } from '../services/vault.js'

const router = Router()
router.use(requireVault)

router.get('/settings', (_req, res) => {
  try {
    const forecast = getVaultData().forecast || { savingsPotId: null }
    res.json({ savingsPotId: forecast.savingsPotId || null })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.put('/settings', (req, res) => {
  try {
    const { savingsPotId } = req.body || {}
    updateVault((v) => {
      if (!v.forecast) v.forecast = { savingsPotId: null }
      v.forecast.savingsPotId =
        savingsPotId === null || savingsPotId === undefined || savingsPotId === ''
          ? null
          : String(savingsPotId)
    })
    const forecast = getVaultData().forecast || { savingsPotId: null }
    res.json({ savingsPotId: forecast.savingsPotId || null })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
