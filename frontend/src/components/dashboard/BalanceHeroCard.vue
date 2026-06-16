<template>
  <div class="balance-hero">
    <span class="balance-hero__label">Available balance</span>
    <span class="balance-hero__amount">{{ formatMoney(balance?.balance) }}</span>
    <div class="balance-hero__meta">
      <span>Total {{ formatMoney(balance?.total_balance) }}</span>
      <span v-if="balance?.spend_today != null" class="balance-hero__spend">
        Spent today {{ formatMoney(Math.abs(balance.spend_today)) }}
      </span>
    </div>
  </div>
</template>

<script>
import { formatMoney } from '../../utils/money.js'

export default {
  name: 'BalanceHeroCard',
  props: {
    balance: { type: Object, default: null }
  },
  methods: { formatMoney }
}
</script>

<style scoped>
.balance-hero {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-radius: 12px;
  padding: 1rem 1.1rem;
  min-height: 0;
  background: var(--sw-panel);
}

.balance-hero__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sw-text-muted);
}

.balance-hero__amount {
  font-size: 1.65rem;
  font-weight: 700;
  color: var(--sw-text-primary);
  line-height: 1.2;
}

.balance-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--sw-text-secondary);
  margin-top: 0.15rem;
}

.balance-hero__spend {
  color: var(--sw-text-muted);
}
</style>
