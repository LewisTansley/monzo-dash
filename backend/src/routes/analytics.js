import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import { getSummary, getProjections } from '../services/analytics.js'
import { getForecast } from '../services/forecast.js'

const router = Router()
router.use(requireVault)

router.get('/summary', async (req, res) => {
  try {
    const period = req.query.period === 'ytd' ? 'ytd' : 'mtd'
    const data = await getSummary(period)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

router.get('/projections', async (req, res) => {
  try {
    const data = await getProjections()
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

router.get('/forecast', async (req, res) => {
  try {
    const data = await getForecast()
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

export default router
