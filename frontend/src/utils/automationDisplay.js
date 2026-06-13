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

export function describeAutomation(automation, context) {
  return {
    when: formatConditions(automation, context),
    then: formatAction(automation, context)
  }
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

  return { summary, steps }
}
