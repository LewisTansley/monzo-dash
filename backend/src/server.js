import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import vaultRoutes from './routes/vault.js'
import authRoutes from './routes/auth.js'
import monzoRoutes from './routes/monzo.js'
import analyticsRoutes from './routes/analytics.js'
import automationRoutes from './routes/automations.js'
import automationGroupRoutes from './routes/automationGroups.js'
import budgetRoutes from './routes/budget.js'
import categoryBudgetRoutes from './routes/budgets.js'
import monzoSetupRoutes from './routes/monzoSetup.js'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/vault', vaultRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/monzo', monzoRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/automations', automationRoutes)
app.use('/api/automation-groups', automationGroupRoutes)
app.use('/api/budget', budgetRoutes)
app.use('/api/budgets', categoryBudgetRoutes)
app.use('/api/monzo/setup', monzoSetupRoutes)

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Monzo Dash API listening on http://127.0.0.1:${config.port}`)
})
