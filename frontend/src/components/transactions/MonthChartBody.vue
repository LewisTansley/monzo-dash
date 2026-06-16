<template>
  <div class="month-chart-body" :class="{ 'month-chart-body--embedded': embedded }">
    <div v-if="hasData && !embedded" class="month-chart-body__stats">
      <div class="month-chart-body__stat">
        <span class="sw-label month-chart-body__stat-label">Spend</span>
        <span class="month-chart-body__stat-value spend">{{ formatMoney(summary.totalSpend) }}</span>
      </div>
      <div class="month-chart-body__stat">
        <span class="sw-label month-chart-body__stat-label">Income</span>
        <span class="month-chart-body__stat-value income">{{ formatMoney(summary.totalIncome) }}</span>
      </div>
      <div class="month-chart-body__stat">
        <span class="sw-label month-chart-body__stat-label">Net</span>
        <span
          class="month-chart-body__stat-value month-chart-body__stat-value--net"
          :class="{ income: summary.net >= 0, spend: summary.net < 0 }">
          {{ formatMoney(summary.net) }}
        </span>
      </div>
    </div>

    <div
      v-if="hasDailyData"
      class="month-chart-body__sparkline"
      :class="{ 'month-chart-body__sparkline--embedded': embedded }">
      <span v-if="!expanded && !embedded" class="sw-label month-chart-body__sparkline-label">Daily flow</span>
      <div
        class="month-chart-body__canvas month-chart-body__canvas--line"
        :style="{ height: lineChartHeight }">
        <canvas ref="lineCanvas" />
      </div>
    </div>

    <div v-if="embedded && hasDailyData" class="month-chart-body__controls">
      <button
        type="button"
        class="month-chart-body__toggle"
        :class="{ active: showCategories }"
        :aria-expanded="showCategories"
        aria-label="Show categories"
        @click="toggleCategories">
        <svg
          class="month-chart-body__chevron"
          :class="{ 'month-chart-body__chevron--expanded': showCategories }"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        v-if="hasCategoryData"
        type="button"
        class="month-chart-body__toggle"
        :class="{ active: showCategories }"
        :aria-expanded="showCategories"
        @click="showCategories = !showCategories">
        Categories
      </button>
    </div>

    <CategoryDonutChart
      v-if="hasCategoryData && !expanded && showDonut"
      variant="compact"
      :top-n="4"
      :by-category="summary.byCategory"
      :hide-center-value="embedded"
      hide-title
      @select-category="onSelectCategory" />

    <div
      v-if="hasCategoryData && expanded"
      class="month-chart-body__canvas month-chart-body__canvas--bars"
      :style="{ height: barChartHeight }">
      <canvas ref="barCanvas" />
    </div>

    <p v-if="!hasData" class="month-chart-body__empty sw-muted">No spending data</p>
  </div>
</template>

<script>
import {
  ensureChartsRegistered,
  createChart,
  destroyChart,
  getCanvasContext,
  observeChartResize,
  onChartSelect
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
import CategoryDonutChart from '../dashboard/CategoryDonutChart.vue'
import { formatMoney } from '../../utils/money.js'
import {
  buildMonthDailySeries,
  aggregateMonthTransactions,
  topSpendCategories
} from '../../utils/transactionAnalytics.js'

export default {
  name: 'MonthChartBody',
  components: { CategoryDonutChart },
  props: {
    transactions: { type: Array, default: () => [] },
    monthKey: { type: String, required: true },
    expanded: { type: Boolean, default: false },
    embedded: { type: Boolean, default: false }
  },
  emits: ['select-category', 'select-date'],
  data() {
    return {
      sparklineExpanded: false,
      showCategories: false
    }
  },
  created() {
    this._lineChart = null
    this._barChart = null
    this._dateKeys = []
    this._categoryKeys = []
  },
  computed: {
    dailySeries() {
      return buildMonthDailySeries(this.transactions, this.monthKey)
    },
    summary() {
      return aggregateMonthTransactions(this.transactions)
    },
    categories() {
      return topSpendCategories(this.summary.byCategory, this.expanded ? 12 : 4)
    },
    hasData() {
      return this.summary.totalSpend > 0 || this.summary.totalIncome > 0
    },
    hasDailyData() {
      return this.dailySeries.some((d) => d.spend > 0 || d.income > 0)
    },
    hasCategoryData() {
      return this.categories.length > 0
    },
    showDonut() {
      return !this.embedded || this.showCategories
    },
    lineChartDetailed() {
      return this.expanded || (this.embedded && this.sparklineExpanded)
    },
    lineChartHeight() {
      if (this.expanded) return '220px'
      if (this.embedded && this.sparklineExpanded) return '110px'
      return '52px'
    },
    barChartHeight() {
      const rows = this.categories.length
      return `${Math.max(120, rows * 28 + 16)}px`
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
    },
    expanded() {
      this.scheduleRender()
    },
    sparklineExpanded() {
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
    toggleCategories() {
      this.showCategories = !this.showCategories
    },
    scheduleRender() {
      this.$nextTick(() => {
        this.renderLineChart()
        this.renderBarChart()
      })
    },
    observeResize() {
      const el = this.$el
      if (!el) return
      this._resizeObs = observeChartResize(el, () => {
        this._lineChart?.resize()
        this._barChart?.resize()
      })
    },
    onSelectCategory(payload) {
      this.$emit('select-category', {
        ...payload,
        monthKey: this.monthKey
      })
    },
    emitDate(index) {
      const date = this._dateKeys[index]
      if (!date) return
      this.$emit('select-date', {
        date,
        monthKey: this.monthKey,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      })
    },
    emitCategory(index) {
      const key = this._categoryKeys[index]
      if (!key) return
      const cat = this.categories.find((c) => c.key === key)
      this.$emit('select-category', {
        category: key,
        monthKey: this.monthKey,
        label: cat?.label || key.replace(/_/g, ' ')
      })
    },
    renderLineChart() {
      if (this._unmounted) return

      if (!this.hasDailyData) {
        this._lineChart = destroyChart(this._lineChart)
        return
      }

      const series = this.dailySeries
      this._dateKeys = series.map((d) => d.date)
      const labels = series.map((d) => String(new Date(d.date + 'T12:00:00').getDate()))
      const income = series.map((d) => (d.income || 0) / 100)
      const spend = series.map((d) => (d.spend || 0) / 100)
      const onClick = onChartSelect(({ index }) => this.emitDate(index))
      const useFill = this.lineChartDetailed
      const showAxes = this.lineChartDetailed

      if (this._lineChart) {
        this._lineChart.data.labels = labels
        this._lineChart.data.datasets[0].data = income
        this._lineChart.data.datasets[1].data = spend
        this._lineChart.data.datasets[0].fill = useFill
        this._lineChart.data.datasets[1].fill = useFill
        this._lineChart.options.onClick = onClick
        this._lineChart.options.plugins.legend.display = showAxes
        this._lineChart.options.scales.x.display = showAxes
        this._lineChart.options.scales.y.display = showAxes
        this._lineChart.update('none')
        this._lineChart.resize()
        return
      }

      const ctx = getCanvasContext(this.$refs.lineCanvas)
      if (!ctx) return

      const incomeDataset = lineDataset('Income', income, chartColors.income, { fill: useFill })
      const spendDataset = lineDataset('Spend', spend, chartColors.spend, { fill: useFill })
      if (!showAxes) {
        incomeDataset.borderWidth = 1.5
        spendDataset.borderWidth = 1.5
      }

      this._lineChart = createChart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [incomeDataset, spendDataset]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          onClick,
          layout: { padding: { left: 0, right: 2, top: 2, bottom: 0 } },
          plugins: {
            legend: { display: showAxes },
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
              display: showAxes,
              ticks: showAxes
                ? {
                    ...axisTicks(),
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 12,
                    font: { size: 9 }
                  }
                : undefined,
              grid: { display: false }
            },
            y: {
              display: showAxes,
              grid: axisGrid()
            }
          }
        }
      })
    },
    renderBarChart() {
      if (this._unmounted) return

      if (!this.expanded || !this.hasCategoryData) {
        this._barChart = destroyChart(this._barChart)
        return
      }

      const labels = this.categories.map((c) => c.label)
      this._categoryKeys = this.categories.map((c) => c.key)
      const values = this.categories.map((c) => c.spend / 100)
      const colors = chartColors.donut.slice(0, labels.length)
      const onClick = onChartSelect(({ index }) => this.emitCategory(index))

      if (this._barChart) {
        this._barChart.data.labels = labels
        this._barChart.data.datasets[0].data = values
        this._barChart.data.datasets[0].backgroundColor = colors.map((c) => rgba(c, 0.75))
        this._barChart.data.datasets[0].borderColor = colors
        this._barChart.options.onClick = onClick
        this._barChart.update('none')
        this._barChart.resize()
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
          onClick,
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
              display: true,
              grid: { display: false },
              ticks: {
                ...axisTicks(),
                callback: (v) => `£${v}`
              }
            },
            y: {
              ticks: {
                ...axisTicks(),
                font: { size: 10 }
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
.month-chart-body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.month-chart-body__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
}

.month-chart-body__stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.month-chart-body__stat-label {
  margin: 0;
}

.month-chart-body__stat-value {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--sw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-chart-body__stat-value--net {
  font-weight: 700;
}

.month-chart-body__stat-value.spend {
  color: var(--sw-danger-soft);
}

.month-chart-body__stat-value.income {
  color: var(--sw-success);
}

.month-chart-body__sparkline {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.month-chart-body__sparkline-label {
  margin: 0;
}

.month-chart-body__canvas {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.month-chart-body__empty {
  margin: 0;
  font-size: 0.7rem;
  text-align: center;
  padding: 0.5rem 0;
}

.month-chart-body--embedded {
  gap: 0.5rem;
}

.month-chart-body__sparkline--embedded {
  border-radius: var(--sw-chrome-radius-inner);
  padding: 0.35rem 0.5rem;
}

.month-chart-body__controls {
  display: flex;
  gap: 0.35rem;
  padding: 0 0.15rem;
}

.month-chart-body__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--sw-text-muted);
  font-size: 0.68rem;
  font-family: inherit;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  cursor: pointer;
}

.month-chart-body__toggle.active {
  background: var(--sw-tab-active-bg);
  color: var(--sw-text-secondary);
}

.month-chart-body__chevron {
  transition: transform 0.15s ease;
}

.month-chart-body__chevron--expanded {
  transform: rotate(180deg);
}
</style>
