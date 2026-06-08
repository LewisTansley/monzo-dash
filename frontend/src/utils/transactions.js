export function formatCategory(cat) {
  return (cat || 'general').replace(/_/g, ' ')
}

export function formatDay(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric' })
}

export function monthFeedToColumn(data) {
  return {
    key: data.month,
    label: data.monthLabel,
    transactions: data.transactions || []
  }
}
