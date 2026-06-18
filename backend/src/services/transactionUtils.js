export function deduplicateTransactionsById(transactions) {
  const byId = new Map()
  for (const tx of transactions || []) {
    byId.set(tx.id, tx)
  }
  return [...byId.values()]
}
