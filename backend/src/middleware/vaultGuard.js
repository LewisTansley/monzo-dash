import { isUnlocked } from '../services/vault.js'

export function requireVault(req, res, next) {
  if (!isUnlocked()) {
    return res.status(403).json({ error: 'Vault is locked' })
  }
  next()
}
