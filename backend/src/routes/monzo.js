import { Router } from 'express'
import { requireVault } from '../middleware/vaultGuard.js'
import {
  getBalance,
  getPots,
  getTransactions,
  getTransactionMonthFeed
} from '../services/monzoClient.js'
import { getVaultData } from '../services/vault.js'
import { filterActivePots } from '../services/potTransfers.js'

const router = Router()
router.use(requireVault)

router.get('/balance', async (req, res) => {
  try {
    const accountId = req.query.account_id || getVaultData().monzo.accountId
    const data = await getBalance(accountId)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

router.get('/pots', async (req, res) => {
  try {
    const accountId = req.query.current_account_id || getVaultData().monzo.accountId
    const data = await getPots(accountId)
    res.json({ ...data, pots: filterActivePots(data.pots) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

router.get('/transactions', async (req, res) => {
  try {
    const accountId = req.query.account_id || getVaultData().monzo.accountId
    const limit = Number(req.query.limit) || 100
    const data = req.query.since
      ? await getTransactions({
          accountId,
          since: req.query.since,
          before: req.query.before,
          limit
        })
      : await getTransactionMonthFeed({
          accountId,
          month: req.query.month || null
        })
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

export default router
