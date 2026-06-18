export function filterActivePots(pots) {
  return (pots || []).filter((p) => !p.deleted)
}

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

function resolvePotTransferPotId(tx, pots) {
  const meta = tx.metadata || {}
  if (meta.pot_id) return meta.pot_id
  const desc = (tx.description || '').trim()
  if (!desc) return null
  const match = (pots || []).find((p) => (p.name || '').trim() === desc)
  return match?.id || null
}

export function annotatePotTransfers(transactions, pots) {
  const potNames = buildPotNamesSet(pots)
  return transactions.map((tx) => {
    const isTransfer = isPotTransfer(tx, potNames)
    return {
      ...tx,
      isPotTransfer: isTransfer,
      potTransferPotId: isTransfer ? resolvePotTransferPotId(tx, pots) : null
    }
  })
}
