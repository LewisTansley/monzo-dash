import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  listAutomationGroups,
  getAutomationGroup,
  createAutomationGroup,
  updateAutomationGroup,
  deleteAutomationGroup,
  dryRunAutomationGroup,
  runAutomationGroup
} from '../services/automationGroupEngine.js'
import { getVaultData } from '../services/vault.js'

const router = Router()
router.use(requireVault)

router.get('/', (_req, res) => {
  try {
    const vault = getVaultData()
    const groups = listAutomationGroups().map((g) => ({
      ...g,
      lastRun: vault.automationGroupRuns?.[g.id] || null
    }))
    res.json({ groups })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.get('/:id', (req, res) => {
  try {
    const group = getAutomationGroup(req.params.id)
    if (!group) return res.status(404).json({ error: 'Not found' })
    const vault = getVaultData()
    res.json({
      group,
      lastRun: vault.automationGroupRuns?.[group.id] || null
    })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const group = createAutomationGroup(req.body)
    res.status(201).json({ group })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const group = updateAutomationGroup(req.params.id, req.body)
    res.json({ group })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    deleteAutomationGroup(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/dry-run', async (req, res) => {
  try {
    const result = await dryRunAutomationGroup(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/run', async (req, res) => {
  try {
    const result = await runAutomationGroup(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
