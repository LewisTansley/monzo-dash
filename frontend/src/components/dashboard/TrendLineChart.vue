<template>
  <div class="trend-chart panel" :class="{ 'trend-chart--expanded': expanded }">
    <h2 v-if="!hideTitle" class="trend-chart__title">Income vs spend ({{ periodLabel }})</h2>
    <div class="trend-chart__canvas">
      <canvas ref="canvasEl" />
    </div>
  </div>
</template>

<script>
import {
  ensureChartsRegistered,
  createChart,
  destroyChart,
  getCanvasContext,
  isChartContainerSized,
  observeChartResize,
  onChartSelect
} from '../charts/chartSetup.js'
import {
  chartColors,
  lineDataset,
  axisTicks,
  axisGrid,
  tooltipConfig,
  formatPoundsTooltip
} from '../charts/chartTheme.js'

export default {
  name: 'TrendLineChart',
  props: {
    dailySeries: { type: Array, default: () => [] },
    period: { type: String, default: 'mtd', validator: (v) => ['mtd', 'ytd'].includes(v) },
    expanded: { type: Boolean, default: false },
    hideTitle: { type: Boolean, default: false },
    selectedDate: { type: String, default: null },
    seriesLabels: {
      type: Object,
      default: () => ({ income: 'Income', spend: 'Spend' })
    }
  },
  emits: ['select-date'],
  computed: {
    periodLabel() {
      return this.period === 'ytd' ? 'YTD' : 'MTD'
    }
  },
  created() {
    this._chart = null
    this._dateKeys = []
  },
  watch: {
    dailySeries: {
      deep: true,
      handler() {
        this.scheduleRender()
      }
    },
    expanded() {
      this.scheduleRender()
    },
    seriesLabels: {
      deep: true,
      handler() {
        this.scheduleRender()
      }
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
    this._chart = destroyChart(this._chart)
  },
  methods: {
    scheduleRender() {
      this.$nextTick(() => this.renderChart())
    },
    observeResize() {
      if (this._resizeObs) return
      const el = this.$refs.canvasEl?.parentElement
      this._resizeObs = observeChartResize(el, {
        getChart: () => this._chart,
        onLayout: () => {
          if (!this._unmounted && !this._chart) this.renderChart()
        }
      })
    },
    emitDate(index) {
      const date = this._dateKeys[index]
      if (!date) return
      this.$emit('select-date', {
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      })
    },
    renderChart() {
      if (this._unmounted) return

      const series = this.dailySeries || []
      this._dateKeys = series.map((d) => d.date)
      const labels = series.map((d) => {
        const date = new Date(d.date + 'T12:00:00')
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      })
      const income = series.map((d) => (d.income || 0) / 100)
      const spend = series.map((d) => (d.spend || 0) / 100)
      const onClick = onChartSelect(({ index }) => this.emitDate(index))

      if (!series.length) {
        this._chart = destroyChart(this._chart)
        return
      }

      const container = this.$refs.canvasEl?.parentElement
      if (!this._chart && !isChartContainerSized(container)) {
        return
      }

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets[0].label = this.seriesLabels.income
        this._chart.data.datasets[0].data = income
        this._chart.data.datasets[1].label = this.seriesLabels.spend
        this._chart.data.datasets[1].data = spend
        this._chart.options.onClick = onClick
        this._chart.update('none')
        this._chart.resize()
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            lineDataset(this.seriesLabels.income, income, chartColors.income, { fill: false }),
            lineDataset(this.seriesLabels.spend, spend, chartColors.spend, { fill: false })
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          onClick,
          layout: {
            padding: { left: 4, right: 8, top: 4, bottom: 4 }
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { color: chartColors.primary, boxWidth: 12, padding: 12, font: { size: 11 } }
            },
            tooltip: {
              ...tooltipConfig(),
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatPoundsTooltip(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: axisTicks(),
              grid: { display: false }
            },
            y: {
              ticks: {
                ...axisTicks(),
                callback: (v) => `£${v}`
              },
              grid: axisGrid()
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.trend-chart {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.trend-chart__title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--sw-text-primary);
}

.trend-chart__canvas {
  width: 100%;
  max-width: 100%;
  height: 240px;
  position: relative;
  overflow: hidden;
}

.trend-chart--expanded .trend-chart__canvas {
  height: 360px;
}
</style>
