<template>
  <div class="forecast-bar-chart" :class="{ 'forecast-bar-chart--expanded': expanded }">
    <div class="forecast-bar-chart__canvas">
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
  observeChartResize
} from '../charts/chartSetup.js'
import {
  chartColors,
  rgba,
  axisTicks,
  axisGrid,
  tooltipConfig,
  formatPoundsTooltip,
  lineDataset
} from '../charts/chartTheme.js'

export default {
  name: 'ForecastBarChart',
  props: {
    monthlyProjections: { type: Array, default: () => [] },
    potMonthlyProjections: { type: Array, default: () => [] },
    showPotLine: { type: Boolean, default: false },
    expanded: { type: Boolean, default: false }
  },
  created() {
    this._chart = null
  },
  watch: {
    monthlyProjections: { deep: true, handler() { this.scheduleRender() } },
    potMonthlyProjections: { deep: true, handler() { this.scheduleRender() } },
    showPotLine() { this.scheduleRender() },
    expanded() { this.scheduleRender() }
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
    renderChart() {
      if (this._unmounted) return
      if (!this.monthlyProjections.length) {
        this._chart = destroyChart(this._chart)
        return
      }
      if (!isChartContainerSized(this.$refs.canvasEl?.parentElement)) return

      const labels = this.monthlyProjections.map((m) => m.label)
      const projected = this.monthlyProjections.map((m) => m.projected.net / 100)
      const priorYear = this.monthlyProjections.map((m) => m.priorYear.net / 100)
      const projectedColors = projected.map((v) =>
        rgba(v >= 0 ? chartColors.income : chartColors.spend, 0.75)
      )
      const projectedBorders = projected.map((v) =>
        v >= 0 ? chartColors.income : chartColors.spend
      )

      const datasets = [
        {
          type: 'bar',
          label: 'Prior year net',
          data: priorYear,
          backgroundColor: rgba(chartColors.quaternary, 0.45),
          borderColor: rgba(chartColors.quaternary, 0.8),
          borderWidth: 1,
          order: 2
        },
        {
          type: 'bar',
          label: 'Projected net',
          data: projected,
          backgroundColor: projectedColors,
          borderColor: projectedBorders,
          borderWidth: 1,
          order: 1
        }
      ]

      if (this.showPotLine && this.potMonthlyProjections.length) {
        datasets.push({
          ...lineDataset(
            'Pot balance',
            this.potMonthlyProjections.map((m) => (m.projectedBalance || 0) / 100),
            chartColors.primary,
            { fill: false }
          ),
          type: 'line',
          yAxisID: 'yPot',
          order: 0,
          borderDash: [4, 3]
        })
      }

      const scales = {
        x: {
          ticks: axisTicks(),
          grid: axisGrid()
        },
        y: {
          ticks: {
            ...axisTicks(),
            callback: (v) => `£${v}`
          },
          grid: axisGrid()
        }
      }

      if (this.showPotLine && this.potMonthlyProjections.length) {
        scales.yPot = {
          position: 'right',
          ticks: {
            ...axisTicks(),
            callback: (v) => `£${v}`
          },
          grid: { display: false }
        }
      }

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets = datasets
        this._chart.options.scales = scales
        this._chart.update('none')
        this._chart.resize()
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              labels: { color: axisTicks().color, boxWidth: 12, font: { size: 11 } }
            },
            tooltip: {
              ...tooltipConfig(),
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatPoundsTooltip(ctx.parsed.y ?? ctx.parsed.x)}`
              }
            }
          },
          scales
        }
      })
    }
  }
}
</script>

<style scoped>
.forecast-bar-chart__canvas {
  position: relative;
  height: 280px;
  min-width: 0;
}

.forecast-bar-chart--expanded .forecast-bar-chart__canvas {
  height: 360px;
}
</style>
