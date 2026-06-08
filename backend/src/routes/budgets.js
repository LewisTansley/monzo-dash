import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import { getVaultData, updateVault } from '../services/vault.js'

const router = Router()
router.use(requireVault)

router.get('/', (_req, res) => {
  try {
    res.json({ budgets: getVaultData().budgets || {} })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  try {
    const { budgets } = req.body
    updateVault((v) => {
      v.budgets = budgets || {}
    })
    res.json({ budgets: getVaultData().budgets })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
