<template>
  <div class="donut-chart panel">
    <h2 class="donut-chart__title">Spending by category</h2>
    <div class="donut-chart__wrap">
      <div class="donut-chart__canvas">
        <canvas ref="canvasEl" />
      </div>
      <div v-if="totalSpend > 0" class="donut-chart__center">
        <span class="donut-chart__center-label">{{ periodLabel }} spend</span>
        <span class="donut-chart__center-value">{{ formatMoney(totalSpend) }}</span>
      </div>
      <p v-else class="donut-chart__empty muted">{{ emptyLabel }}</p>
    </div>
    <ul v-if="legendItems.length" class="donut-chart__legend">
      <li v-for="item in legendItems" :key="item.label" class="donut-chart__legend-item">
        <span class="donut-chart__swatch" :style="{ backgroundColor: item.color }" />
        <span class="donut-chart__legend-label">{{ item.label }}</span>
      </li>
    </ul>
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
import { chartColors, tooltipConfig, formatPoundsTooltip } from '../charts/chartTheme.js'
import { formatMoney } from '../../utils/money.js'

const TOP_N = 6

export default {
  name: 'CategoryDonutChart',
  props: {
    byCategory: { type: Object, default: () => ({}) },
    period: { type: String, default: 'mtd', validator: (v) => ['mtd', 'ytd'].includes(v) }
  },
  computed: {
    periodLabel() {
      return this.period === 'ytd' ? 'YTD' : 'MTD'
    },
    emptyLabel() {
      return this.period === 'ytd' ? 'No spending this year' : 'No spending this month'
    }
  },
  created() {
    this._chart = null
  },
  data() {
    return { totalSpend: 0, legendItems: [] }
  },
  watch: {
    byCategory: {
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
    formatMoney,
    buildSegments() {
      const entries = Object.entries(this.byCategory || {})
        .filter(([, v]) => v.spend > 0)
        .sort((a, b) => b[1].spend - a[1].spend)

      const top = entries.slice(0, TOP_N)
      const rest = entries.slice(TOP_N)
      const otherSpend = rest.reduce((sum, [, v]) => sum + v.spend, 0)

      const labels = top.map(([k]) => k.replace(/_/g, ' '))
      const values = top.map(([, v]) => v.spend / 100)

      if (otherSpend > 0) {
        labels.push('Other')
        values.push(otherSpend / 100)
      }

      this.totalSpend = entries.reduce((sum, [, v]) => sum + v.spend, 0)
      const colors = chartColors.donut.slice(0, labels.length)
      this.legendItems = labels.map((label, i) => ({ label, color: colors[i] }))
      return { labels, values, colors }
    },
    scheduleRender() {
      this.$nextTick(() => this.renderChart())
    },
    observeResize() {
      const el = this.$refs.canvasEl?.parentElement
      this._resizeObs = observeChartResize(el, () => this._chart)
    },
    renderChart() {
      if (this._unmounted) return

      const { labels, values, colors } = this.buildSegments()

      if (!labels.length) {
        this.legendItems = []
        this._chart = destroyChart(this._chart)
        return
      }

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets[0].data = values
        this._chart.data.datasets[0].backgroundColor = colors
        this._chart.update('none')
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          layout: {
            padding: { left: 4, right: 4, top: 4, bottom: 4 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipConfig(),
              callbacks: {
                label: (ctx) => `${ctx.label}: ${formatPoundsTooltip(ctx.parsed)}`
              }
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.donut-chart {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.donut-chart__title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.donut-chart__wrap {
  position: relative;
  height: 200px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.donut-chart__canvas {
  width: 100%;
  max-width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.donut-chart__center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.donut-chart__legend {
  list-style: none;
  margin: 0.65rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.donut-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--sw-text-secondary);
  min-width: 0;
}

.donut-chart__swatch {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.donut-chart__legend-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: capitalize;
}

.donut-chart__center-label {
  display: block;
  font-size: 0.7rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.donut-chart__center-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--sw-text-primary);
}

.donut-chart__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

.muted { color: var(--sw-text-muted); }
</style>
