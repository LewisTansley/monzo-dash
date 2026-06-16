<template>
  <div class="metric-card" :class="{ 'metric-card--expanded': expanded }">
    <span v-if="!hideLabel" class="metric-card__label">{{ label }}</span>
    <span class="metric-card__value" :class="tone">{{ formatMoney(value) }}</span>
    <div class="metric-card__sparkline">
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
  rgba,
  axisTicks,
  axisGrid,
  tooltipConfig,
  formatPoundsTooltip
} from '../charts/chartTheme.js'
import { formatMoney } from '../../utils/money.js'

export default {
  name: 'MetricCard',
  props: {
    label: { type: String, required: true },
    value: { type: Number, default: 0 },
    dailySeries: { type: Array, default: () => [] },
    seriesKey: { type: String, default: 'spend', validator: (v) => ['spend', 'income'].includes(v) },
    tone: { type: String, default: 'neutral', validator: (v) => ['neutral', 'positive', 'negative'].includes(v) },
    expanded: { type: Boolean, default: false },
    hideLabel: { type: Boolean, default: false }
  },
  emits: ['select-date'],
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
    seriesKey() {
      this.scheduleRender()
    },
    expanded() {
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
    this._chart = destroyChart(this._chart)
  },
  methods: {
    formatMoney,
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
        seriesKey: this.seriesKey,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      })
    },
    renderChart() {
      if (this._unmounted) return

      const sliceLen = this.expanded ? this.dailySeries.length : 14
      const series = (this.dailySeries || []).slice(-sliceLen)
      this._dateKeys = series.map((d) => d.date)
      const color = this.seriesKey === 'income' ? chartColors.income : chartColors.spend
      const values = series.map((d) => (d[this.seriesKey] || 0) / 100)
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
        this._chart.data.labels = series.map((d) => d.date)
        this._chart.data.datasets[0].data = values
        this._chart.data.datasets[0].borderColor = color
        this._chart.data.datasets[0].backgroundColor = rgba(color, this.expanded ? 0.12 : 0.15)
        this._chart.options.onClick = onClick
        this._chart.options.plugins.legend.display = this.expanded
        this._chart.options.plugins.tooltip.enabled = this.expanded
        this._chart.options.scales.x.display = this.expanded
        this._chart.options.scales.y.display = this.expanded
        this._chart.update('none')
        this._chart.resize()
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'line',
        data: {
          labels: series.map((d) => d.date),
          datasets: [lineDataset(this.label, values, color, { fill: true })]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: this.expanded },
            tooltip: this.expanded
              ? {
                  ...tooltipConfig(),
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${formatPoundsTooltip(ctx.parsed.y)}`
                  }
                }
              : { enabled: false }
          },
          scales: {
            x: {
              display: this.expanded,
              ticks: axisTicks(),
              grid: { display: false }
            },
            y: {
              display: this.expanded,
              ticks: {
                ...axisTicks(),
                callback: (v) => `£${v}`
              },
              grid: axisGrid()
            }
          },
          animation: { duration: 400 }
        }
      })
    }
  }
}
</script>

<style scoped>
.metric-card {
  background: var(--sw-panel);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.metric-card__label {
  font-size: 0.75rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric-card__value {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--sw-text-primary);
}

.metric-card__value.positive { color: var(--sw-success); }
.metric-card__value.negative { color: var(--sw-danger-soft); }

.metric-card__sparkline {
  flex: 1;
  min-height: 48px;
  margin-top: 0.35rem;
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.metric-card--expanded .metric-card__sparkline {
  min-height: 280px;
}
</style>
