const SOURCE_PRIORITY = {
  syncing: 3,
  warning: 2,
  ok: 1,
  unknown: 0
}

const SOURCE_LABELS = {
  ok: 'OK',
  syncing: 'Syncing history',
  warning: 'Partial data',
  unknown: 'Unknown'
}

export function formatLastRefreshed(iso) {
  if (!iso) return null
  const when = new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `Last refreshed: ${when}`
}

/**
 * Derive a single data-source status from one or more API signal objects.
 * Higher-priority states win when merging.
 */
export function deriveDataSourceStatus(signals) {
  const list = Array.isArray(signals) ? signals : [signals]
  let best = { source: 'unknown', detail: null }

  for (const raw of list) {
    if (!raw) continue
    const { syncInProgress, incomplete, cacheGap, detail } = raw

    let source = 'ok'
    if (syncInProgress) source = 'syncing'
    else if (incomplete || cacheGap) source = 'warning'

    if (SOURCE_PRIORITY[source] > SOURCE_PRIORITY[best.source]) {
      best = {
        source,
        detail: detail || raw.incompleteReason || raw.message || null
      }
    } else if (
      SOURCE_PRIORITY[source] === SOURCE_PRIORITY[best.source] &&
      !best.detail &&
      (detail || raw.incompleteReason || raw.message)
    ) {
      best.detail = detail || raw.incompleteReason || raw.message
    }
  }

  return best
}

export function dataSourceLabel(source, lastRefreshedAt = null) {
  if (source === 'syncing') return SOURCE_LABELS.syncing
  if (source === 'warning') return SOURCE_LABELS.warning
  if (lastRefreshedAt) return formatLastRefreshed(lastRefreshedAt)
  return SOURCE_LABELS[source] || SOURCE_LABELS.unknown
}
