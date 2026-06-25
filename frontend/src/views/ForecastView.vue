<template>
  <div class="forecast-view">
    <AppletShell variant="bare">
      <div class="applet-center applet-center--page">
        <div class="applet-center-inner">
          <header class="page-header">
            <div>
              <p class="sw-muted page-header__subtitle">
                Year-over-year seasonal forecast adjusted by your current MTD and YTD pace vs the same
                periods last year. Positive net means estimated savings; negative means estimated loss.
              </p>
            </div>
          </header>

          <p v-if="error" class="sw-message error">{{ error }}</p>
          <p v-if="forecast?.incomplete" class="sw-message warning">
            {{ forecast.incompleteReason }}
          </p>

          <div v-if="loading && !forecast" class="sw-empty">Loading forecast…</div>

          <template v-else-if="forecast">
            <section class="panel pot-panel">
              <h2 class="sw-section-title">Savings pot</h2>
              <div class="sw-form-section pot-form">
                <label>
                  Track pot growth
                  <select
                    :value="savingsPotId || ''"
                    :disabled="savingPot"
                    @change="onPotChange($event.target.value)">
                    <option value="">None — account forecast only</option>
                    <option v-for="pot in pots" :key="pot.id" :value="pot.id">
                      {{ pot.name }} ({{ formatMoney(pot.balance) }})
                    </option>
                  </select>
                </label>
                <div v-if="forecast.savingsPot?.missing" class="sw-message warning">
                  Saved pot no longer exists. Choose another pot or clear the selection.
                </div>
                <div v-else-if="forecast.savingsPot" class="pot-balance-row">
                  <span class="sw-label">Current balance</span>
                  <span class="sw-stat-value">{{ formatMoney(forecast.savingsPot.currentBalance) }}</span>
                  <span v-if="forecast.savingsPot.pace?.usedAccountFallback" class="sw-muted pot-fallback-hint">
                    Using account pace — limited pot transfer history
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 class="sw-section-title">Horizons</h2>
              <div class="stats-grid">
                <div v-for="n in horizonKeys" :key="n" class="stat-card">
                  <span class="stat-label">Next {{ n }} {{ n === 1 ? 'month' : 'months' }}</span>
                  <span
                    class="stat-value"
                    :class="valueClass(forecast.horizons[n]?.projectedNet)">
                    {{ formatMoney(forecast.horizons[n]?.projectedNet || 0) }}
                  </span>
                  <span class="sw-muted stat-meta">
                    Balance {{ formatMoney(forecast.balance) }}
                    → {{ formatMoney(forecast.horizons[n]?.projectedBalance || 0) }}
                  </span>
                  <span
                    v-if="forecast.savingsPot && !forecast.savingsPot.missing"
                    class="sw-muted stat-meta">
                    Pot {{ formatMoney(forecast.savingsPot.currentBalance) }}
                    → {{ formatMoney(forecast.savingsPot.horizons[n]?.projectedBalance || 0) }}
                  </span>
                </div>
              </div>
              <p v-if="forecast.missingMonths?.length" class="sw-muted horizons-hint">
                Some months use estimated baselines — run historical sync for full accuracy.
              </p>
            </section>

            <p
              v-if="forecast.horizons[12]"
              class="callout"
              :class="forecast.horizons[12].projectedNet >= 0 ? 'surplus' : 'deficit'">
              <template v-if="forecast.horizons[12].projectedNet >= 0">
                Estimated savings of {{ formatMoney(forecast.horizons[12].projectedNet) }} over the
                next 12 months based on last year's patterns and your current pace.
              </template>
              <template v-else>
                Estimated shortfall of
                {{ formatMoney(Math.abs(forecast.horizons[12].projectedNet)) }} over the next 12
                months based on last year's patterns and your current pace.
              </template>
            </p>

            <section class="panel">
              <h2 class="sw-section-title">Pace vs last year</h2>
              <div class="pace-grid">
                <div class="pace-block sw-sidebar-stack-nested">
                  <span class="sw-label">Month to date</span>
                  <div class="sw-stat-row">
                    <div class="sw-stat">
                      <span class="sw-muted">This year net</span>
                      <span class="sw-stat-value" :class="valueClass(forecast.comparisons.mtd.current.net)">
                        {{ formatMoney(forecast.comparisons.mtd.current.net) }}
                      </span>
                    </div>
                    <div class="sw-stat">
                      <span class="sw-muted">Last year net</span>
                      <span class="sw-stat-value">
                        {{ formatMoney(forecast.comparisons.mtd.priorYear.net) }}
                      </span>
                    </div>
                  </div>
                  <div class="pace-badges">
                    <span class="sw-badge" :class="factorBadgeClass(forecast.pace.mtd.spendFactor)">
                      Spend {{ formatFactor(forecast.pace.mtd.spendFactor) }}
                    </span>
                    <span class="sw-badge" :class="factorBadgeClass(forecast.pace.mtd.incomeFactor)">
                      Income {{ formatFactor(forecast.pace.mtd.incomeFactor) }}
                    </span>
                  </div>
                </div>
                <div class="pace-block sw-sidebar-stack-nested">
                  <span class="sw-label">Year to date</span>
                  <div class="sw-stat-row">
                    <div class="sw-stat">
                      <span class="sw-muted">This year net</span>
                      <span class="sw-stat-value" :class="valueClass(forecast.comparisons.ytd.current.net)">
                        {{ formatMoney(forecast.comparisons.ytd.current.net) }}
                      </span>
                    </div>
                    <div class="sw-stat">
                      <span class="sw-muted">Last year net</span>
                      <span class="sw-stat-value">
                        {{ formatMoney(forecast.comparisons.ytd.priorYear.net) }}
                      </span>
                    </div>
                  </div>
                  <div class="pace-badges">
                    <span class="sw-badge" :class="factorBadgeClass(forecast.pace.ytd.spendFactor)">
                      Spend {{ formatFactor(forecast.pace.ytd.spendFactor) }}
                    </span>
                    <span class="sw-badge" :class="factorBadgeClass(forecast.pace.ytd.incomeFactor)">
                      Income {{ formatFactor(forecast.pace.ytd.incomeFactor) }}
                    </span>
                  </div>
                </div>
              </div>
              <p class="sw-muted pace-blended">
                Blended adjustment: spending ×{{ forecast.pace.blended.spendFactor.toFixed(2) }},
                income ×{{ forecast.pace.blended.incomeFactor.toFixed(2) }}
              </p>
            </section>

            <section>
              <ChartPanelShell @expand="chartExpanded = true">
                <template #title>
                  <h2 class="sw-section-title">Monthly breakdown</h2>
                </template>
                <ForecastBarChart
                  v-if="!chartExpanded"
                  :monthly-projections="forecast.monthlyProjections"
                  :pot-monthly-projections="forecast.savingsPot?.monthlyProjections || []"
                  :show-pot-line="Boolean(forecast.savingsPot && !forecast.savingsPot.missing)" />
              </ChartPanelShell>
            </section>

            <section class="panel">
              <h2 class="sw-section-title">Month by month</h2>
              <div
                class="forecast-table ledger-table"
                :class="{ 'forecast-table--with-pot': forecast.savingsPot && !forecast.savingsPot.missing }">
                <div class="item-row item-head">
                  <span>Month</span>
                  <span>Prior year</span>
                  <span>Projected</span>
                  <span>Delta</span>
                  <span v-if="forecast.savingsPot && !forecast.savingsPot.missing">Pot net</span>
                </div>
                <div
                  v-for="(row, index) in forecast.monthlyProjections"
                  :key="row.monthKey"
                  class="item-row">
                  <span>
                    {{ row.label }}
                    <span v-if="row.isCurrent" class="sw-badge">Current</span>
                    <span
                      v-else-if="row.baselineSource && row.baselineSource !== 'priorYear'"
                      class="sw-badge estimated-badge">
                      Estimated
                    </span>
                  </span>
                  <span class="sw-secondary">{{ formatMoney(row.priorYear.net) }}</span>
                  <span :class="valueClass(row.projected.net)">{{ formatMoney(row.projected.net) }}</span>
                  <span :class="valueClass(row.projected.net - row.priorYear.net)">
                    {{ formatSigned(row.projected.net - row.priorYear.net) }}
                  </span>
                  <span
                    v-if="forecast.savingsPot && !forecast.savingsPot.missing"
                    :class="valueClass(potRowNet(index))">
                    {{ formatMoney(potRowNet(index)) }}
                  </span>
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>
    </AppletShell>

    <ChartDetailModal
      :is-open="chartExpanded"
      title="Monthly breakdown"
      @close="chartExpanded = false">
      <template #chart>
        <ForecastBarChart
          v-if="chartExpanded && forecast"
          expanded
          :monthly-projections="forecast.monthlyProjections"
          :pot-monthly-projections="forecast.savingsPot?.monthlyProjections || []"
          :show-pot-line="Boolean(forecast.savingsPot && !forecast.savingsPot.missing)" />
      </template>
    </ChartDetailModal>
  </div>
</template>

<script>
import { AppletShell } from '@/components/common'
import ChartDetailModal from '@/components/charts/ChartDetailModal.vue'
import ChartPanelShell from '@/components/charts/ChartPanelShell.vue'
import ForecastBarChart from '@/components/forecast/ForecastBarChart.vue'
import { analyticsApi, forecastSettingsApi, monzoApi } from '@/services/api.js'
import { formatMoney } from '@/utils/money.js'
import { useDataStatusStore } from '@/stores/dataStatus.js'

export default {
  name: 'ForecastView',
  components: {
    AppletShell,
    ChartDetailModal,
    ChartPanelShell,
    ForecastBarChart
  },
  data() {
    return {
      loading: false,
      savingPot: false,
      error: null,
      forecast: null,
      pots: [],
      savingsPotId: null,
      chartExpanded: false
    }
  },
  computed: {
    dataStatus() {
      return useDataStatusStore()
    },
    horizonKeys() {
      return [1, 3, 6, 12]
    }
  },
  watch: {
    'dataStatus.refreshGeneration'() {
      if (this.dataStatus.refreshing) {
        this.handleAppRefresh()
      }
    }
  },
  mounted() {
    this.dataStatus.clearSignals()
    this.loadAll()
  },
  methods: {
    formatMoney,
    valueClass(value) {
      if (value > 0) return 'positive'
      if (value < 0) return 'negative'
      return ''
    },
    formatSigned(value) {
      const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
      return `${prefix}${formatMoney(Math.abs(value))}`
    },
    formatFactor(factor) {
      const pct = Math.round((factor - 1) * 100)
      if (pct === 0) return 'on par'
      return pct > 0 ? `+${pct}%` : `${pct}%`
    },
    factorBadgeClass(factor) {
      if (factor > 1.05) return 'pace-high'
      if (factor < 0.95) return 'pace-low'
      return ''
    },
    potRowNet(index) {
      return this.forecast?.savingsPot?.monthlyProjections?.[index]?.projected?.net ?? 0
    },
    async onPotChange(value) {
      const savingsPotId = value || null
      this.savingPot = true
      try {
        await forecastSettingsApi.set({ savingsPotId })
        this.savingsPotId = savingsPotId
        await this.loadForecast()
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.savingPot = false
      }
    },
    async loadForecast() {
      const { data } = await analyticsApi.forecast()
      this.forecast = data
      this.dataStatus.report({
        incomplete: data.incomplete,
        detail: data.incompleteReason || undefined
      })
    },
    async loadAll() {
      this.loading = true
      this.error = null
      try {
        const [settingsRes, potsRes] = await Promise.all([
          forecastSettingsApi.get(),
          monzoApi.pots()
        ])
        this.savingsPotId = settingsRes.data.savingsPotId || null
        this.pots = (potsRes.data.pots || []).filter((p) => !p.deleted)
        await this.loadForecast()
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.loading = false
      }
    },
    async handleAppRefresh() {
      try {
        this.dataStatus.clearSignals()
        await this.loadAll()
      } finally {
        this.dataStatus.finishRefresh()
      }
    }
  }
}
</script>

<style scoped>
.forecast-view {
  height: 100%;
  min-height: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header__subtitle {
  margin: 0;
  max-width: 42rem;
}

.panel {
  background: var(--sw-panel);
  border-radius: var(--sw-chrome-radius-inner);
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.pot-panel .sw-section-title {
  margin-bottom: 0.75rem;
}

.pot-form {
  margin: 0;
}

.pot-balance-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  margin-top: 0.75rem;
}

.pot-fallback-hint {
  font-size: 0.8rem;
  width: 100%;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-card {
  background: var(--sw-panel);
  border-radius: var(--sw-chrome-radius-inner);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
}

.stat-value.positive,
.positive {
  color: var(--sw-success);
}

.stat-value.negative,
.negative {
  color: var(--sw-danger-soft);
}

.stat-meta {
  font-size: 0.8rem;
  line-height: 1.35;
}

.callout {
  padding: 0.85rem 1rem;
  border-radius: var(--sw-chrome-radius-inner);
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.callout.surplus {
  background: rgba(var(--sw-accent-green-rgb), 0.12);
  color: var(--sw-success);
  border: 1px solid rgba(var(--sw-accent-green-rgb), 0.25);
}

.callout.deficit {
  background: rgba(var(--sw-danger-rgb), 0.12);
  color: var(--sw-danger-soft);
  border: 1px solid rgba(var(--sw-danger-rgb), 0.25);
}

.horizons-hint {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}

.estimated-badge {
  margin-left: 0.35rem;
  font-size: 0.7rem;
  opacity: 0.85;
}

.pace-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pace-block {
  padding: 0.85rem 1rem;
  border-radius: var(--sw-chrome-radius-inner);
}

.pace-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.pace-badges .sw-badge.pace-high {
  background: rgba(var(--sw-accent-orange-rgb), 0.2);
  color: var(--sw-accent-orange);
}

.pace-badges .sw-badge.pace-low {
  background: rgba(var(--sw-accent-green-rgb), 0.2);
  color: var(--sw-success);
}

.pace-blended {
  margin: 0;
  font-size: 0.85rem;
}

.forecast-table--with-pot {
  grid-template-columns:
    minmax(0, 1.2fr)
    minmax(0, 1fr)
    minmax(0, 1fr)
    minmax(0, 1fr)
    minmax(0, 1fr);
}

.forecast-table:not(.forecast-table--with-pot) {
  grid-template-columns:
    minmax(0, 1.2fr)
    minmax(0, 1fr)
    minmax(0, 1fr)
    minmax(0, 1fr);
}

.forecast-table {
  display: grid;
  column-gap: 0.75rem;
  row-gap: 0.35rem;
}

.forecast-table .item-row {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--sw-border);
  font-size: 0.9rem;
}

.forecast-table .item-row:last-child {
  border-bottom: none;
}

.item-head {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sw-text-muted);
  border-bottom: 1px solid var(--sw-border-strong);
  padding-bottom: 0.5rem;
}

[data-layout='mobile'] .stats-grid {
  grid-template-columns: repeat(2, 1fr);
}

[data-layout='mobile'] .pace-grid {
  grid-template-columns: 1fr;
}
</style>
