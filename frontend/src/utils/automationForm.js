import { parsePoundsToMinor, minorToPoundsInput } from './money.js'
import {
  defaultAutoTriggerForm,
  autoTriggerToForm,
  autoTriggerToPayload
} from './automationTriggerForm.js'

export function emptyCondition(accountId) {
  return {
    source: { type: 'account', id: accountId },
    field: 'balance',
    operator: 'gt',
    value: { mode: 'absolute', amount: 0 },
    valueInput: ''
  }
}

export function defaultForm(accountId) {
  return {
    name: '',
    enabled: true,
    showOnDashboard: true,
    conditionLogic: 'all',
    conditions: [emptyCondition(accountId)],
    action: {
      type: 'deposit',
      source: { type: 'account', id: accountId },
      destination: { type: 'pot', id: '' },
      amount: { mode: 'fixed', value: 0, basis: 'source_balance' }
    },
    actionAmountInput: '',
    autoTrigger: defaultAutoTriggerForm()
  }
}

export function automationToForm(automation) {
  const a = automation
  return {
    name: a.name,
    enabled: a.enabled,
    showOnDashboard: a.showOnDashboard,
    conditionLogic: a.conditionLogic || 'all',
    conditions: (a.conditions || []).map((c) => ({
      ...c,
      valueInput:
        c.value.mode === 'absolute' ? minorToPoundsInput(c.value.amount) : ''
    })),
    action: a.action,
    actionAmountInput:
      a.action.amount.mode === 'fixed'
        ? minorToPoundsInput(a.action.amount.value)
        : '',
    autoTrigger: autoTriggerToForm(a.autoTrigger)
  }
}

export function formToPayload(form, accountId) {
  const conditions = form.conditions.map((c) => ({
    source: { ...c.source },
    field: 'balance',
    operator: c.operator,
    value: {
      mode: c.value.mode,
      amount:
        c.value.mode === 'absolute'
          ? parsePoundsToMinor(c.valueInput)
          : c.value.amount
    }
  }))

  const action = JSON.parse(JSON.stringify(form.action))
  if (action.amount.mode === 'fixed') {
    action.amount.value = parsePoundsToMinor(form.actionAmountInput)
  }
  if (action.type === 'deposit') {
    action.source = { type: 'account', id: accountId }
    action.destination = { type: 'pot', id: action.destination.id }
  } else {
    const potId = action.source?.id
    const validPotId = potId && potId !== accountId ? potId : ''
    action.source = { type: 'pot', id: validPotId }
    action.destination = { type: 'account', id: accountId }
  }

  return {
    name: form.name,
    enabled: form.enabled,
    showOnDashboard: form.showOnDashboard,
    conditionLogic: form.conditionLogic,
    conditions,
    action,
    autoTrigger: autoTriggerToPayload(form.autoTrigger)
  }
}

function isGtOperator(op) {
  return op === 'gt' || op === 'gte'
}

function isLtOperator(op) {
  return op === 'lt' || op === 'lte'
}

function findUnambiguousPotCondition(conditions, operatorKind) {
  const filtered = (conditions || []).filter((c) => {
    if (c.source?.type !== 'pot') return false
    if (operatorKind === 'gt') return isGtOperator(c.operator)
    if (operatorKind === 'lt') return isLtOperator(c.operator)
    return false
  })
  if (filtered.length === 1) return filtered[0]
  return null
}

export function syncRemainderAction(form, pots, accountId) {
  const mode = form.action?.amount?.mode
  if (mode !== 'remainder' && mode !== 'remainder_below') return

  const operatorKind = mode === 'remainder' ? 'gt' : 'lt'
  const cond = findUnambiguousPotCondition(form.conditions, operatorKind)
  if (!cond) return

  if (mode === 'remainder') {
    form.action.type = 'withdraw'
    form.action.source = { type: 'pot', id: cond.source.id }
    form.action.destination = { type: 'account', id: accountId }
  } else {
    form.action.type = 'deposit'
    form.action.source = { type: 'account', id: accountId }
    if (!form.action.destination) {
      form.action.destination = { type: 'pot', id: '' }
    }
    form.action.destination.id = cond.source.id
  }
}

export function ensureWithdrawSourcePot(form, pots) {
  if (form.action.type !== 'withdraw') return
  const sourceId = form.action.source?.id
  const isPotId = pots.some((p) => p.id === sourceId)
  if (!isPotId && pots[0]) {
    form.action.source = { type: 'pot', id: pots[0].id }
  }
}

export function ensureDepositDestinationPot(form, pots) {
  if (form.action.type !== 'deposit') return
  const destId = form.action.destination?.id
  const isPotId = pots.some((p) => p.id === destId)
  if (!isPotId && pots[0]) {
    if (!form.action.destination) {
      form.action.destination = { type: 'pot', id: '' }
    }
    form.action.destination.id = pots[0].id
  }
}

export function onActionTypeChange(form, pots, accountId) {
  if (form.action.type === 'withdraw') {
    ensureWithdrawSourcePot(form, pots)
  } else {
    ensureDepositDestinationPot(form, pots)
    form.action.source = { type: 'account', id: accountId }
  }
  syncRemainderAction(form, pots, accountId)
}
