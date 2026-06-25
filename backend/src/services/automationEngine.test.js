import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateConditions,
  computeActionAmount,
  getFundingBalance
} from './automationEngine.js'

const ACCOUNT_ID = 'acc_test'

function makeAutomation(overrides = {}) {
  return {
    conditions: [],
    conditionLogic: 'all',
    action: {
      type: 'deposit',
      source: { type: 'account', id: ACCOUNT_ID },
      destination: { type: 'pot', id: 'pot_holiday' },
      amount: { mode: 'fixed', value: 0 }
    },
    ...overrides
  }
}

function potGtCondition(potId, threshold, balance) {
  return {
    condition: {
      source: { type: 'pot', id: potId },
      operator: 'gt',
      value: { mode: 'absolute', amount: threshold }
    },
    balance,
    threshold,
    met: balance > threshold
  }
}

function accountGtCondition(threshold, balance) {
  return {
    condition: {
      source: { type: 'account', id: ACCOUNT_ID },
      operator: 'gt',
      value: { mode: 'absolute', amount: threshold }
    },
    balance,
    threshold,
    met: balance > threshold
  }
}

describe('computeActionAmount remainder mode', () => {
  it('withdraws pot excess above threshold', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'pot', id: 'pot_emergency' },
          operator: 'gt',
          value: { mode: 'absolute', amount: 100_000 }
        }
      ],
      action: {
        type: 'withdraw',
        source: { type: 'pot', id: 'pot_emergency' },
        destination: { type: 'account', id: ACCOUNT_ID },
        amount: { mode: 'remainder' }
      }
    })
    const balances = {
      'pot:pot_emergency': 150_000,
      [`account:${ACCOUNT_ID}`]: 50_000
    }
    const { details } = evaluateConditions(automation, balances)
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 50_000)
  })

  it('deposits main account excess above threshold', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'account', id: ACCOUNT_ID },
          operator: 'gt',
          value: { mode: 'absolute', amount: 50_000 }
        }
      ],
      action: {
        type: 'deposit',
        source: { type: 'account', id: ACCOUNT_ID },
        destination: { type: 'pot', id: 'pot_holiday' },
        amount: { mode: 'remainder' }
      }
    })
    const balances = {
      [`account:${ACCOUNT_ID}`]: 80_000,
      'pot:pot_holiday': 10_000
    }
    const { details } = evaluateConditions(automation, balances)
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 30_000)
  })

  it('uses drawdown finder when withdraw source pot is unset but one gt pot condition exists', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'pot', id: 'pot_emergency' },
          operator: 'gt',
          value: { mode: 'absolute', amount: 100_000 }
        }
      ],
      action: {
        type: 'withdraw',
        source: { type: 'pot', id: '' },
        destination: { type: 'account', id: ACCOUNT_ID },
        amount: { mode: 'remainder' }
      }
    })
    const balances = { 'pot:pot_emergency': 150_000 }
    const details = [potGtCondition('pot_emergency', 100_000, 150_000)]
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 50_000)
  })

  it('returns zero for deposit when only a pot gt condition exists (cannot fund from pot)', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'pot', id: 'pot_emergency' },
          operator: 'gt',
          value: { mode: 'absolute', amount: 100_000 }
        }
      ],
      action: {
        type: 'deposit',
        source: { type: 'account', id: ACCOUNT_ID },
        destination: { type: 'pot', id: 'pot_holiday' },
        amount: { mode: 'remainder' }
      }
    })
    const balances = {
      'pot:pot_emergency': 150_000,
      [`account:${ACCOUNT_ID}`]: 0,
      'pot:pot_holiday': 0
    }
    const details = [potGtCondition('pot_emergency', 100_000, 150_000)]
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 0)
  })

  it('remainder_below tops up pot shortfall on deposit', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'pot', id: 'pot_emergency' },
          operator: 'lt',
          value: { mode: 'absolute', amount: 100_000 }
        }
      ],
      action: {
        type: 'deposit',
        source: { type: 'account', id: ACCOUNT_ID },
        destination: { type: 'pot', id: 'pot_emergency' },
        amount: { mode: 'remainder_below' }
      }
    })
    const balances = {
      'pot:pot_emergency': 40_000,
      [`account:${ACCOUNT_ID}`]: 200_000
    }
    const { details } = evaluateConditions(automation, balances)
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 60_000)
  })

  it('prefers account gt for deposit remainder over dest pot lt condition', () => {
    const automation = makeAutomation({
      conditions: [
        {
          source: { type: 'account', id: ACCOUNT_ID },
          operator: 'gt',
          value: { mode: 'absolute', amount: 50_000 }
        },
        {
          source: { type: 'pot', id: 'pot_holiday' },
          operator: 'lt',
          value: { mode: 'absolute', amount: 200_000 }
        }
      ],
      action: {
        type: 'deposit',
        source: { type: 'account', id: ACCOUNT_ID },
        destination: { type: 'pot', id: 'pot_holiday' },
        amount: { mode: 'remainder' }
      }
    })
    const balances = {
      [`account:${ACCOUNT_ID}`]: 80_000,
      'pot:pot_holiday': 100_000
    }
    const { details } = evaluateConditions(automation, balances)
    const amount = computeActionAmount(automation, balances, details, ACCOUNT_ID)
    assert.equal(amount, 30_000)
  })
})

describe('getFundingBalance', () => {
  it('caps deposit by main account balance', () => {
    const action = {
      type: 'deposit',
      source: { type: 'account', id: ACCOUNT_ID },
      destination: { type: 'pot', id: 'pot_holiday' }
    }
    const balances = {
      [`account:${ACCOUNT_ID}`]: 25_000,
      'pot:pot_holiday': 0
    }
    assert.equal(getFundingBalance(action, balances, ACCOUNT_ID), 25_000)
  })

  it('caps withdraw by source pot balance', () => {
    const action = {
      type: 'withdraw',
      source: { type: 'pot', id: 'pot_emergency' },
      destination: { type: 'account', id: ACCOUNT_ID }
    }
    const balances = {
      'pot:pot_emergency': 75_000,
      [`account:${ACCOUNT_ID}`]: 0
    }
    assert.equal(getFundingBalance(action, balances, ACCOUNT_ID), 75_000)
  })
})
