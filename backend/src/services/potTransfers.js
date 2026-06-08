export function buildPotNamesSet(pots) {
  return new Set(
    pots.map((p) => (p.name || '').trim()).filter(Boolean)
  )
}

export function isPotTransfer(tx, potNames) {
  const meta = tx.metadata || {}
  if (meta.pot_account_id || meta.pot_id) return true
  const desc = (tx.description || '').trim()
  return Boolean(desc && potNames.has(desc))
}

export function filterSpendableTransactions(transactions, potNames) {
  return transactions.filter((tx) => !isPotTransfer(tx, potNames))
}

export function annotatePotTransfers(transactions, pots) {
  const potNames = buildPotNamesSet(pots)
  return transactions.map((tx) => ({
    ...tx,
    isPotTransfer: isPotTransfer(tx, potNames)
  }))
}
