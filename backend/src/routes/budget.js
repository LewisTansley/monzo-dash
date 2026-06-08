import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  getBudget,
  createItem,
  updateItem,
  deleteItem
} from '../services/budget.js'

const router = Router()
router.use(requireVault)

router.get('/', (_req, res) => {
  try {
    res.json(getBudget())
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
})

router.post('/items', (req, res) => {
  try {
    const item = createItem(req.body)
    res.status(201).json({ item, ...getBudget() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/items/:id', (req, res) => {
  try {
    const item = updateItem(req.params.id, req.body)
    res.json({ item, ...getBudget() })
  } catch (err) {
    const status = err.message === 'Item not found' ? 404 : 400
    res.status(status).json({ error: err.message })
  }
})

router.delete('/items/:id', (req, res) => {
  try {
    deleteItem(req.params.id)
    res.json(getBudget())
  } catch (err) {
    const status = err.message === 'Item not found' ? 404 : 400
    res.status(status).json({ error: err.message })
  }
})

export default router
