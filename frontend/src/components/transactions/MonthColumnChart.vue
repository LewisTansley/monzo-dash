<template>
  <div class="month-column-chart">
    <div v-if="hasData" class="month-column-chart__stats">
      <div class="month-column-chart__stat">
        <span class="month-column-chart__stat-label">Spend</span>
        <span class="month-column-chart__stat-value spend">{{ formatMoney(summary.totalSpend) }}</span>
      </div>
      <div class="month-column-chart__stat">
        <span class="month-column-chart__stat-label">Income</span>
        <span class="month-column-chart__stat-value income">{{ formatMoney(summary.totalIncome) }}</span>
      </div>
      <div class="month-column-chart__stat">
        <span class="month-column-chart__stat-label">Net</span>
        <span
          class="month-column-chart__stat-value"
          :class="{ income: summary.net >= 0, spend: summary.net < 0 }">
          {{ formatMoney(summary.net) }}
        </span>
      </div>
    </div>

    <div v-if="hasDailyData" class="month-column-chart__canvas month-column-chart__canvas--line">
      <canvas ref="lineCanvas" />
    </div>

    <div v-if="hasCategoryData" class="month-column-chart__canvas month-column-chart__canvas--bars">
      <canvas ref="barCanvas" />
    </div>

    <p v-if="!hasData" class="month-column-chart__empty sw-muted">No spending data</p>
  </div>
</template>

<script>
import {
  ensureChartsRegistered,
  createChart,
  destroyChart,
  getCanvasContext,
  observeChartResize
} from '../charts/chartSetup.js'
import {
  chartColors,
  lineDataset,
  axisTicks,
  axisGrid,
  tooltipConfig,
  formatPoundsTooltip,
  rgba
} from '../charts/chartTheme.js'
import { formatMoney } from '../../utils/money.js'
import {
  buildMonthDailySeries,
  aggregateMonthTransactions,
  topSpendCategories
} from '../../utils/transactionAnalytics.js'

export default {
  name: 'MonthColumnChart',
  props: {
    transactions: { type: Array, default: () => [] },
    monthKey: { type: String, required: true }
  },
  created() {
    this._lineChart = null
    this._barChart = null
  },
  computed: {
    dailySeries() {
      return buildMonthDailySeries(this.transactions, this.monthKey)
    },
    summary() {
      return aggregateMonthTransactions(this.transactions)
    },
    categories() {
      return topSpendCategories(this.summary.byCategory, 4)
    },
    hasData() {
      return this.summary.totalSpend > 0 || this.summary.totalIncome > 0
    },
    hasDailyData() {
      return this.dailySeries.some((d) => d.spend > 0 || d.income > 0)
    },
    hasCategoryData() {
      return this.categories.length > 0
    }
  },
  watch: {
    transactions: {
      deep: true,
      handler() {
        this.scheduleRender()
      }
    },
    monthKey() {
      this.scheduleRender()
    }
  },
  mounted() {
    ensureChartsRegistered()
    this.scheduleRender()
    this.observeResize()
  },
  beforeUnmount() {
    this._unmounted = true
    this._resizeObs?.disconnect()
    this._lineChart = destroyChart(this._lineChart)
    this._barChart = destroyChart(this._barChart)
  },
  methods: {
    formatMoney,
    scheduleRender() {
      this.$nextTick(() => {
        this.renderLineChart()
        this.renderBarChart()
      })
    },
    observeResize() {
      const el = this.$el
      this._resizeObs = observeChartResize(el, () => {
        this._lineChart?.resize()
        this._barChart?.resize()
      })
    },
    renderLineChart() {
      if (this._unmounted) return

      if (!this.hasDailyData) {
        this._lineChart = destroyChart(this._lineChart)
        return
      }

      const series = this.dailySeries
      const labels = series.map((d) => String(new Date(d.date + 'T12:00:00').getDate()))
      const income = series.map((d) => (d.income || 0) / 100)
      const spend = series.map((d) => (d.spend || 0) / 100)

      if (this._lineChart) {
        this._lineChart.data.labels = labels
        this._lineChart.data.datasets[0].data = income
        this._lineChart.data.datasets[1].data = spend
        this._lineChart.update('none')
        return
      }

      const ctx = getCanvasContext(this.$refs.lineCanvas)
      if (!ctx) return

      this._lineChart = createChart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            lineDataset('Income', income, chartColors.income, { fill: true }),
            lineDataset('Spend', spend, chartColors.spend, { fill: true })
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          layout: { padding: { left: 0, right: 2, top: 2, bottom: 0 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipConfig(),
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex
                  const day = series[idx]
                  if (!day) return ''
                  const date = new Date(day.date + 'T12:00:00')
                  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                },
                label: (ctx) => `${ctx.dataset.label}: ${formatPoundsTooltip(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: {
                ...axisTicks(),
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 6,
                font: { size: 9 }
              },
              grid: { display: false }
            },
            y: {
              display: false,
              grid: axisGrid()
            }
          }
        }
      })
    },
    renderBarChart() {
      if (this._unmounted) return

      if (!this.hasCategoryData) {
        this._barChart = destroyChart(this._barChart)
        return
      }

      const labels = this.categories.map((c) => c.label)
      const values = this.categories.map((c) => c.spend / 100)
      const colors = chartColors.donut.slice(0, labels.length)

      if (this._barChart) {
        this._barChart.data.labels = labels
        this._barChart.data.datasets[0].data = values
        this._barChart.data.datasets[0].backgroundColor = colors.map((c) => rgba(c, 0.75))
        this._barChart.data.datasets[0].borderColor = colors
        this._barChart.update('none')
        return
      }

      const ctx = getCanvasContext(this.$refs.barCanvas)
      if (!ctx) return

      this._barChart = createChart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Spend',
            data: values,
            backgroundColor: colors.map((c) => rgba(c, 0.75)),
            borderColor: colors,
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { left: 0, right: 4, top: 0, bottom: 0 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipConfig(),
              callbacks: {
                label: (ctx) => formatPoundsTooltip(ctx.parsed.x)
              }
            }
          },
          scales: {
            x: {
              display: false,
              grid: { display: false }
            },
            y: {
              ticks: {
                ...axisTicks(),
                font: { size: 9 }
              },
              grid: { display: false }
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.month-column-chart {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.65rem 0.6rem;
  border-bottom: 1px solid var(--sw-border);
  background: var(--sw-panel-inset);
}

.month-column-chart__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
}

.month-column-chart__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.month-column-chart__stat-label {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
}

.month-column-chart__stat-value {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--sw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-column-chart__stat-value.spend {
  color: var(--sw-danger-soft);
}

.month-column-chart__stat-value.income {
  color: var(--sw-success);
}

.month-column-chart__canvas {
  position: relative;
  width: 100%;
}

.month-column-chart__canvas--line {
  height: 88px;
}

.month-column-chart__canvas--bars {
  height: 72px;
}

.month-column-chart__empty {
  margin: 0;
  font-size: 0.7rem;
  text-align: center;
  padding: 0.5rem 0;
}
</style>
