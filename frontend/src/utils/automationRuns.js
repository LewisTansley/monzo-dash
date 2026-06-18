import { formatMoney } from './money.js'

export function formatRunTime(at) {
  if (!at) return ''
  return new Date(at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export function summarizeAutomationRun(lastRun) {
  if (!lastRun?.at) return null

  const time = formatRunTime(lastRun.at)
  const status = lastRun.status || (lastRun.amount != null ? 'success' : 'success')
  const autoPrefix = lastRun.source === 'auto' ? 'Auto · ' : ''

  if (status === 'success') {
    const amountLabel = lastRun.amount != null ? formatMoney(lastRun.amount) : 'Completed'
    return {
      time,
      status,
      label: `${autoPrefix}Transferred ${amountLabel}`,
      short: amountLabel
    }
  }

  if (status === 'skipped') {
    const message = lastRun.message || 'Skipped'
    return { time, status, label: `${autoPrefix}${message}`, short: 'Skipped' }
  }

  if (status === 'error') {
    const message = lastRun.message || 'Failed'
    return { time, status, label: `${autoPrefix}${message}`, short: 'Failed' }
  }

  return { time, status: 'success', label: `${autoPrefix}Ran`, short: 'Ran' }
}

export function summarizeGroupRun(lastRun, automations = []) {
  if (!lastRun?.at) return null

  const time = formatRunTime(lastRun.at)
  const results = lastRun.results || []
  const successCount = results.filter((r) => r.status === 'success').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorResult = results.find((r) => r.status === 'error')

  let status = lastRun.status
  if (!status) {
    status = errorResult ? 'error' : successCount > 0 ? 'success' : 'skipped'
  }

  let label = 'No steps ran'
  if (errorResult) {
    label = errorResult.message || 'Run failed'
  } else if (successCount > 0) {
    label = `${successCount} transferred${skippedCount ? `, ${skippedCount} skipped` : ''}`
  } else if (skippedCount > 0) {
    label = `${skippedCount} skipped`
  }

  const steps = results.map((r) => {
    const name = automations.find((a) => a.id === r.automationId)?.name || 'Step'
    if (r.status === 'success') return `${name}: ${formatMoney(r.amount)}`
    if (r.status === 'error') return `${name}: ${r.message || 'failed'}`
    return `${name}: ${r.message || 'skipped'}`
  })

  let short = 'Skipped'
  if (status === 'success') short = `${successCount} ran`
  if (status === 'error') short = 'Failed'
  const autoPrefix = lastRun.source === 'auto' ? 'Auto · ' : ''

  return { time, status, label: `${autoPrefix}${label}`, short, steps }
}

export function runStatusLabel(status) {
  if (status === 'success') return 'Success'
  if (status === 'skipped') return 'Skipped'
  if (status === 'error') return 'Failed'
  return 'Unknown'
}

export function runStatusClass(status) {
  if (status === 'success') return 'run-success'
  if (status === 'skipped') return 'run-skipped'
  if (status === 'error') return 'run-error'
  return ''
}

export function summarizeActivityEntry(entry) {
  if (!entry?.at) return null

  if (entry.kind === 'group') {
    return summarizeGroupRun(
      {
        at: entry.at,
        status: entry.status,
        source: entry.source,
        results: entry.results || []
      },
      (entry.results || []).map((r) => ({ id: r.automationId, name: r.automationId }))
    )
  }

  return summarizeAutomationRun({
    at: entry.at,
    status: entry.status,
    source: entry.source,
    amount: entry.amount,
    message: entry.message
  })
}
