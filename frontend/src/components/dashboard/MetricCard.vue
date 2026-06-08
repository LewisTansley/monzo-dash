<template>
  <div class="metric-card">
    <span class="metric-card__label">{{ label }}</span>
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
  getCanvasContext
} from '../charts/chartSetup.js'
import { chartColors, lineDataset, rgba } from '../charts/chartTheme.js'
import { formatMoney } from '../../utils/money.js'

export default {
  name: 'MetricCard',
  props: {
    label: { type: String, required: true },
    value: { type: Number, default: 0 },
    dailySeries: { type: Array, default: () => [] },
    seriesKey: { type: String, default: 'spend', validator: (v) => ['spend', 'income'].includes(v) },
    tone: { type: String, default: 'neutral', validator: (v) => ['neutral', 'positive', 'negative'].includes(v) }
  },
  created() {
    this._chart = null
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
    }
  },
  mounted() {
    ensureChartsRegistered()
    this.scheduleRender()
  },
  beforeUnmount() {
    this._unmounted = true
    this._chart = destroyChart(this._chart)
  },
  methods: {
    formatMoney,
    scheduleRender() {
      this.$nextTick(() => this.renderChart())
    },
    renderChart() {
      if (this._unmounted) return

      const series = (this.dailySeries || []).slice(-14)
      const color = this.seriesKey === 'income' ? chartColors.income : chartColors.spend
      const values = series.map((d) => (d[this.seriesKey] || 0) / 100)

      if (!series.length) {
        this._chart = destroyChart(this._chart)
        return
      }

      if (this._chart) {
        this._chart.data.labels = series.map((d) => d.date)
        this._chart.data.datasets[0].data = values
        this._chart.data.datasets[0].borderColor = color
        this._chart.data.datasets[0].backgroundColor = rgba(color, 0.15)
        this._chart.update('none')
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
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false }
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
  border: 1px solid var(--sw-border);
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
</style>
