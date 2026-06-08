<template>
  <div class="category-chart">
    <canvas ref="canvasEl" />
  </div>
</template>

<script>
import { ensureChartsRegistered, createChart, destroyChart, getCanvasContext } from './charts/chartSetup.js'

export default {
  name: 'CategoryChart',
  props: {
    byCategory: { type: Object, default: () => ({}) }
  },
  created() {
    this._chart = null
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
  },
  beforeUnmount() {
    this._unmounted = true
    this._chart = destroyChart(this._chart)
  },
  methods: {
    scheduleRender() {
      this.$nextTick(() => this.renderChart())
    },
    renderChart() {
      if (this._unmounted) return

      const entries = Object.entries(this.byCategory || {})
        .filter(([, v]) => v.spend > 0)
        .sort((a, b) => b[1].spend - a[1].spend)
        .slice(0, 8)

      const labels = entries.map(([k]) => k.replace(/_/g, ' '))
      const values = entries.map(([, v]) => v.spend / 100)

      if (!labels.length) {
        this._chart = destroyChart(this._chart)
        return
      }

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets[0].data = values
        this._chart.update('none')
        return
      }

      const ctx = getCanvasContext(this.$refs.canvasEl)
      if (!ctx) return

      this._chart = createChart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Spend',
            data: values,
            backgroundColor: 'rgba(102, 163, 255, 0.7)',
            borderColor: '#66a3ff',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `£${ctx.parsed.x.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#6b7280' },
              grid: { color: 'rgba(105, 115, 156, 0.15)' }
            },
            y: {
              ticks: { color: '#a0aec0' },
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
.category-chart {
  height: 220px;
  position: relative;
  background: transparent;
}
</style>
