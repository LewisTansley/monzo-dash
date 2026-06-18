export function matchesPot(tx, pot) {
  if (!tx?.isPotTransfer || !pot) return false
  if (tx.potTransferPotId && tx.potTransferPotId === pot.id) return true
  const meta = tx.metadata || {}
  if (meta.pot_id && meta.pot_id === pot.id) return true
  const desc = (tx.description || '').trim()
  return Boolean(desc && desc === (pot.name || '').trim())
}
