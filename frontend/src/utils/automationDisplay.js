import { formatMoney } from './money.js'

const OPERATOR_LABELS = {
  gt: 'greater than',
  gte: 'greater than or equal to',
  lt: 'less than',
  lte: 'less than or equal to',
  eq: 'equal to'
}

const LOGIC_INTRO = {
  all: 'All of the following',
  any: 'Any of the following'
}

const DEFAULT_CONTEXT = {
  pots: [],
  accountLabel: 'Main account'
}

function normalizeContext(context = {}) {
  return { ...DEFAULT_CONTEXT, ...context }
}

export function sourceLabel(source, context) {
  const ctx = normalizeContext(context)
  if (!source || source.type === 'account') return ctx.accountLabel
  const pot = ctx.pots.find((p) => p.id === source.id)
  return pot?.name ? `${pot.name} pot` : 'Unknown pot'
}

function formatConditionValue(condition, context) {
  const { value } = condition
  if (value?.mode === 'percent') {
    const source = sourceLabel(condition.source, context)
    return `${value.amount}% of ${source} balance`
  }
  return formatMoney(value?.amount)
}

export function formatCondition(condition, context) {
  const source = sourceLabel(condition.source, context)
  const op = OPERATOR_LABELS[condition.operator] || condition.operator
  const val = formatConditionValue(condition, context)
  return `${source} balance is ${op} ${val}`
}

export function formatConditions(automation, context) {
  const conditions = automation.conditions || []
  if (!conditions.length) return 'No conditions (always runs)'

  const parts = conditions.map((c) => formatCondition(c, context))
  if (conditions.length === 1) return parts[0]

  const logic = automation.conditionLogic === 'any' ? 'any' : 'all'
  return `${LOGIC_INTRO[logic]}: ${parts.join('; ')}`
}

function formatActionAmount(action, context) {
  const amt = action?.amount
  if (!amt) return ''

  if (amt.mode === 'percent') {
    const pct = `${amt.value}%`
    if (amt.basis === 'condition_threshold') {
      return `${pct} of the condition threshold`
    }
    const sourceName =
      action.type === 'deposit'
        ? normalizeContext(context).accountLabel
        : sourceLabel(action.source, context)
    return `${pct} of ${sourceName} balance`
  }

  if (amt.mode === 'remainder') {
    return 'the remainder above the threshold'
  }

  if (amt.mode === 'remainder_below') {
    return 'the remainder below the threshold'
  }

  return formatMoney(amt.value)
}

export function formatAction(automation, context) {
  const action = automation.action
  if (!action) return 'No action configured'

  const ctx = normalizeContext(context)
  const amountStr = formatActionAmount(action, context)

  if (action.type === 'deposit') {
    const pot = sourceLabel({ type: 'pot', id: action.destination?.id }, context)
    return `Deposit ${amountStr} from ${ctx.accountLabel} into ${pot}`
  }

  const pot = sourceLabel(action.source, context)
  return `Withdraw ${amountStr} from ${pot} to ${ctx.accountLabel}`
}

const MODE_LABELS = {
  conditions: 'when balance conditions are met',
  schedule: 'on schedule',
  schedule_and_conditions: 'on schedule when conditions are met'
}

const SCHEDULE_TYPE_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  interval_days: 'Every N days'
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const FREQUENCY_LABELS = {
  once_per_window: 'per schedule window',
  once_per_day: 'per calendar day'
}

function formatRunLimit(autoTrigger) {
  const runLimit = autoTrigger.runLimit || { mode: 'once' }
  const window = FREQUENCY_LABELS[autoTrigger.frequency] || autoTrigger.frequency

  if (runLimit.mode === 'unlimited') {
    return `unlimited times ${window}`
  }

  if (runLimit.mode === 'count') {
    const max = runLimit.max || 2
    const countNote =
      runLimit.countAttempts === 'successful' ? ' (successful only)' : ''
    return `at most ${max} times ${window}${countNote}`
  }

  return `at most once ${window}`
}

export function formatAutoTrigger(autoTrigger) {
  if (!autoTrigger?.enabled) return ''

  const mode = MODE_LABELS[autoTrigger.mode] || autoTrigger.mode
  const limit = formatRunLimit(autoTrigger)
  const parts = [`Auto-run ${mode}`, limit]

  if (autoTrigger.mode === 'schedule' || autoTrigger.mode === 'schedule_and_conditions') {
    const schedule = autoTrigger.schedule || {}
    const typeLabel = SCHEDULE_TYPE_LABELS[schedule.type] || schedule.type
    parts.push(`${typeLabel} at ${schedule.time || '09:00'}`)

    if (schedule.type === 'weekly' && schedule.daysOfWeek?.length) {
      const days = schedule.daysOfWeek.map((d) => DAY_LABELS[d] || d).join(', ')
      parts.push(`on ${days}`)
    }
    if (schedule.type === 'monthly') {
      parts.push(`on day ${schedule.dayOfMonth || 1}`)
    }
    if (schedule.type === 'interval_days') {
      parts.push(`every ${schedule.intervalDays || 1} days from ${schedule.anchorDate}`)
    }
  }

  return parts.join(' · ')
}

export function describeAutomation(automation, context) {
  const base = {
    when: formatConditions(automation, context),
    then: formatAction(automation, context)
  }
  const auto = formatAutoTrigger(automation.autoTrigger)
  if (auto) {
    return { ...base, auto }
  }
  return base
}

export function describeAutomationOneLine(automation, context) {
  const { when, then } = describeAutomation(automation, context)
  return `When ${when.toLowerCase()}, ${then.charAt(0).toLowerCase()}${then.slice(1)}`
}

export function describeGroup(group, automations, context) {
  const ids = group.automationIds || []
  if (!ids.length) {
    return { summary: 'No members', steps: [] }
  }

  const steps = ids.map((id) => {
    const auto = automations.find((a) => a.id === id)
    if (!auto) {
      return {
        name: 'Unknown',
        when: 'Automation not found',
        then: '',
        summary: 'Automation not found'
      }
    }
    const desc = describeAutomation(auto, context)
    return {
      name: auto.name,
      ...desc,
      summary: describeAutomationOneLine(auto, context)
    }
  })

  const firstAuto = automations.find((a) => a.id === ids[0])
  const summary =
    ids.length === 1 && firstAuto
      ? describeAutomationOneLine(firstAuto, context)
      : `${ids.length} automations in sequence`

  const auto = formatAutoTrigger(group.autoTrigger)
  return { summary, steps, auto }
}
