import { parsePoundsToMinor, minorToPoundsInput } from './money.js'

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
    actionAmountInput: ''
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
        : ''
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
    action.source = { type: 'pot', id: action.source.id }
    action.destination = { type: 'account', id: accountId }
  }

  return {
    name: form.name,
    enabled: form.enabled,
    showOnDashboard: form.showOnDashboard,
    conditionLogic: form.conditionLogic,
    conditions,
    action
  }
}
