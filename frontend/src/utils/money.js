export function formatMoney(minorUnits, currency = 'GBP') {
  const amount = (minorUnits || 0) / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency
  }).format(amount)
}

export function parsePoundsToMinor(value) {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

export function minorToPoundsInput(minor) {
  return ((minor || 0) / 100).toFixed(2)
}
