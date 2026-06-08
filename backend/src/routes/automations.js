import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  dryRunAutomation,
  runAutomation
} from '../services/automationEngine.js'
import { getVaultData } from '../services/vault.js'

const router = Router()
router.use(requireVault)

router.get('/', (_req, res) => {
  try {
    const vault = getVaultData()
    const automations = listAutomations().map((a) => ({
      ...a,
      lastRun: vault.automationRuns[a.id] || null
    }))
    res.json({ automations })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.get('/:id', (req, res) => {
  try {
    const automation = getAutomation(req.params.id)
    if (!automation) return res.status(404).json({ error: 'Not found' })
    const vault = getVaultData()
    res.json({
      automation,
      lastRun: vault.automationRuns[automation.id] || null
    })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const automation = createAutomation(req.body)
    res.status(201).json({ automation })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const automation = updateAutomation(req.params.id, req.body)
    res.json({ automation })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    deleteAutomation(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/dry-run', async (req, res) => {
  try {
    const result = await dryRunAutomation(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/run', async (req, res) => {
  try {
    const result = await runAutomation(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
