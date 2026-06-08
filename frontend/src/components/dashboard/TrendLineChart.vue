<template>
  <div class="trend-chart panel">
    <h2 class="trend-chart__title">Income vs spend ({{ periodLabel }})</h2>
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
  observeChartResize
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
    period: { type: String, default: 'mtd', validator: (v) => ['mtd', 'ytd'].includes(v) }
  },
  computed: {
    periodLabel() {
      return this.period === 'ytd' ? 'YTD' : 'MTD'
    }
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
      const el = this.$refs.canvasEl?.parentElement
      this._resizeObs = observeChartResize(el, () => this._chart)
    },
    renderChart() {
      if (this._unmounted) return

      const series = this.dailySeries || []
      const labels = series.map((d) => {
        const date = new Date(d.date + 'T12:00:00')
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      })
      const income = series.map((d) => (d.income || 0) / 100)
      const spend = series.map((d) => (d.spend || 0) / 100)

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets[0].data = income
        this._chart.data.datasets[1].data = spend
        this._chart.update('none')
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            lineDataset('Income', income, chartColors.income, { fill: false }),
            lineDataset('Spend', spend, chartColors.spend, { fill: false })
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
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
</style>
