import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  ensureMonzoAccountLinked,
  diagnoseMonzoConnection
} from '../services/monzoClient.js'
import { getVaultStatus } from '../services/vault.js'

const router = Router()
router.use(requireVault)

router.get('/diagnose', async (_req, res) => {
  try {
    const diagnosis = await diagnoseMonzoConnection()
    res.json({ ...getVaultStatus(), diagnosis })
  } catch (err) {
    res.status(400).json({ error: err.message, ...getVaultStatus() })
  }
})

router.post('/complete', async (_req, res) => {
  try {
    const accountId = await ensureMonzoAccountLinked()
    res.json({ ok: true, accountId, ...getVaultStatus() })
  } catch (err) {
    const diagnosis = await diagnoseMonzoConnection().catch(() => null)
    res.status(400).json({
      error: err.message,
      diagnosis,
      ...getVaultStatus()
    })
  }
})

export default router
