<!-- eslint-disable vue/no-mutating-props -- editForm is a mutable draft owned by the parent -->
<template>
  <div class="section-panel">
    <div v-show="activeSection === 'basics'" class="sw-form-section">
      <label>
        Name
        <input v-model="form.name" required />
      </label>
      <label class="checkbox">
        <input v-model="form.enabled" type="checkbox" />
        Enabled
      </label>
      <label class="checkbox">
        <input v-model="form.showOnDashboard" type="checkbox" />
        Show on dashboard
      </label>
    </div>

    <div v-show="activeSection === 'conditions'" class="sw-form-section">
      <label>
        Match
        <select v-model="form.conditionLogic">
          <option value="all">All conditions (AND)</option>
          <option value="any">Any condition (OR)</option>
        </select>
      </label>

      <div
        v-for="(cond, idx) in form.conditions"
        :key="idx"
        class="condition-row">
        <select v-model="cond.source.type" @change="onSourceTypeChange(cond)">
          <option value="account">Main account</option>
          <option value="pot">Pot</option>
        </select>
        <select v-if="cond.source.type === 'pot'" v-model="cond.source.id">
          <option v-for="p in pots" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="cond.operator">
          <option value="gt">Greater than</option>
          <option value="gte">Greater or equal</option>
          <option value="lt">Less than</option>
          <option value="lte">Less or equal</option>
          <option value="eq">Equal to</option>
        </select>
        <select v-model="cond.value.mode">
          <option value="absolute">Amount (£)</option>
          <option value="percent">Percent (%)</option>
        </select>
        <input
          v-if="cond.value.mode === 'absolute'"
          v-model="cond.valueInput"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00" />
        <input
          v-else
          v-model.number="cond.value.amount"
          type="number"
          min="0"
          max="100"
          placeholder="%" />
        <button type="button" class="remove-btn" @click="removeCondition(idx)">Remove</button>
      </div>
      <BaseButton variant="secondary" text="Add condition" @click="addCondition" />
    </div>

    <div v-show="activeSection === 'action'" class="sw-form-section">
      <label>
        Type
        <select v-model="form.action.type">
          <option value="deposit">Deposit to pot</option>
          <option value="withdraw">Withdraw from pot</option>
        </select>
      </label>

      <label v-if="form.action.type === 'deposit'">
        Destination pot
        <select v-model="form.action.destination.id">
          <option v-for="p in pots" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label v-else>
        Source pot
        <select v-model="form.action.source.id">
          <option v-for="p in pots" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>

      <label>
        Amount mode
        <select v-model="form.action.amount.mode">
          <option value="fixed">Fixed amount (£)</option>
          <option value="percent">Percentage</option>
          <option value="remainder">Remainder above threshold</option>
          <option value="remainder_below">Remainder below threshold</option>
        </select>
      </label>

      <p
        v-if="isRemainderAmountMode"
        class="mode-hint">
        Transfers the gap between the condition balance and its threshold,
        capped by available funds. Works for both directions: pot below £80
        deposits the shortfall; pot above £80 withdraws the excess; main
        account below £0 withdraws from a pot.
      </p>
      <p
        v-if="form.action.type === 'deposit' && form.action.amount.mode === 'fixed'"
        class="mode-hint">
        When the condition checks the same destination pot with “less than”,
        the fixed amount is treated as a target balance (e.g. pot at £40 with
        target £80 deposits £40).
      </p>

      <label v-if="!isRemainderAmountMode">
        {{ form.action.amount.mode === 'percent' ? 'Percent' : 'Amount (£)' }}
        <input
          v-if="form.action.amount.mode === 'fixed'"
          v-model="form.actionAmountInput"
          type="number"
          min="0"
          step="0.01" />
        <input
          v-else
          v-model.number="form.action.amount.value"
          type="number"
          min="0"
          max="100" />
      </label>

      <label v-if="form.action.amount.mode === 'percent'">
        Basis
        <select v-model="form.action.amount.basis">
          <option value="source_balance">Source balance</option>
          <option value="condition_threshold">Condition threshold</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script>
import { BaseButton } from '../common'
import { emptyCondition } from '../../utils/automationForm.js'

export default {
  name: 'AutomationSectionPanel',
  components: { BaseButton },
  props: {
    form: {
      type: Object,
      required: true
    },
    pots: {
      type: Array,
      default: () => []
    },
    accountId: {
      type: String,
      default: ''
    },
    activeSection: {
      type: String,
      required: true
    }
  },
  computed: {
    isRemainderAmountMode() {
      const mode = this.form.action?.amount?.mode
      return mode === 'remainder' || mode === 'remainder_below'
    }
  },
  methods: {
    onSourceTypeChange(cond) {
      if (cond.source.type === 'account') {
        cond.source.id = this.accountId
      } else if (this.pots[0]) {
        cond.source.id = this.pots[0].id
      }
    },
    addCondition() {
      // eslint-disable-next-line vue/no-mutating-props -- mutable edit draft
      this.form.conditions.push(emptyCondition(this.accountId))
    },
    removeCondition(idx) {
      // eslint-disable-next-line vue/no-mutating-props -- mutable edit draft
      this.form.conditions.splice(idx, 1)
    }
  }
}
</script>

<style scoped>
.section-panel {
  margin-top: 1rem;
}

.condition-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: end;
}

.remove-btn {
  background: transparent;
  border: 1px solid var(--sw-danger);
  color: var(--sw-danger-soft);
  padding: 0.5rem;
  border-radius: var(--sw-chrome-radius-inner);
  cursor: pointer;
  font-size: 0.8rem;
}

.mode-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--sw-text-muted);
  line-height: 1.4;
}
</style>
