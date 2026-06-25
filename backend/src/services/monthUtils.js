export function currentMonthKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null
  return { year, month }
}

export function formatMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  })
}

export function previousMonthKey(year, month) {
  if (month === 0) return formatMonthKey(year - 1, 11)
  return formatMonthKey(year, month - 1)
}

export function isCurrentMonth(year, month) {
  const now = new Date()
  return year === now.getFullYear() && month === now.getMonth()
}

/** Previous calendar month relative to today. */
export function previousMonthFromNow() {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() - 1
  if (month < 0) {
    month = 11
    year -= 1
  }
  return { year, month, monthKey: formatMonthKey(year, month) }
}

/** Month key N calendar months before the given key (0 = same month). */
export function monthKeyMonthsAgo(monthKey, monthsAgo) {
  const parsed = parseMonthKey(monthKey)
  if (!parsed || monthsAgo < 0) return monthKey

  let { year, month } = parsed
  for (let i = 0; i < monthsAgo; i++) {
    if (month === 0) {
      month = 11
      year -= 1
    } else {
      month -= 1
    }
  }
  return formatMonthKey(year, month)
}

/** Inclusive list of month keys from start to end (both YYYY-MM), oldest first. */
export function monthKeysBetween(startKey, endKey) {
  const start = parseMonthKey(startKey)
  const end = parseMonthKey(endKey)
  if (!start || !end) return []

  const keys = []
  let year = start.year
  let month = start.month

  while (year < end.year || (year === end.year && month <= end.month)) {
    keys.push(formatMonthKey(year, month))
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return keys
}
