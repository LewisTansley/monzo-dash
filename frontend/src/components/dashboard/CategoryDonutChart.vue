<template>
  <div class="donut-chart" :class="rootClasses">
    <h2 v-if="showTitle" class="donut-chart__title">Spending by category</h2>
    <div class="donut-chart__wrap" :class="{ 'donut-chart__wrap--compact': isCompact }">
      <div class="donut-chart__canvas">
        <canvas ref="canvasEl" />
      </div>
      <div
        v-if="totalSpend > 0 && !hideCenterValue"
        class="donut-chart__center"
        :class="{ 'donut-chart__center--compact': isCompact }">
        <span v-if="!isCompact" class="donut-chart__center-label">{{ periodLabel }} spend</span>
        <span class="donut-chart__center-value" :class="{ 'donut-chart__center-value--compact': isCompact }">
          {{ formatMoney(totalSpend) }}
        </span>
      </div>
      <p v-else-if="totalSpend <= 0" class="donut-chart__empty muted">{{ emptyLabel }}</p>
    </div>
    <ul
      v-if="legendItems.length"
      class="donut-chart__legend"
      :class="{
        'donut-chart__legend--compact': isCompact,
        'donut-chart__legend--hide-center': hideCenterValue
      }">
      <li
        v-for="(item, index) in legendItems"
        :key="item.label"
        class="donut-chart__legend-item"
        :class="{ active: selectedIndex === index }"
        role="button"
        tabindex="0"
        :aria-label="`View ${item.label} transactions`"
        @click="onLegendClick(index)"
        @keydown.enter.prevent="onLegendClick(index)"
        @keydown.space.prevent="onLegendClick(index)">
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
  isChartContainerSized,
  observeChartResize,
  onChartSelect
} from '../charts/chartSetup.js'
import { chartColors, tooltipConfig, formatPoundsTooltip } from '../charts/chartTheme.js'
import { formatMoney } from '../../utils/money.js'
import { otherCategoryKeys } from '../../utils/transactionFilters.js'

const TOP_N = 6

export default {
  name: 'CategoryDonutChart',
  props: {
    byCategory: { type: Object, default: () => ({}) },
    period: { type: String, default: 'mtd', validator: (v) => ['mtd', 'ytd'].includes(v) },
    variant: { type: String, default: 'panel', validator: (v) => ['panel', 'compact'].includes(v) },
    topN: { type: Number, default: TOP_N },
    expanded: { type: Boolean, default: false },
    hideTitle: { type: Boolean, default: false },
    hideCenterValue: { type: Boolean, default: false },
    selectedCategory: { type: [String, Array], default: null }
  },
  emits: ['select-category'],
  beforeCreate() {
    this._chart = null
    this._segmentKeys = []
  },
  data() {
    return { totalSpend: 0, legendItems: [], selectedIndex: null }
  },
  computed: {
    isCompact() {
      return this.variant === 'compact'
    },
    showTitle() {
      return !this.hideTitle && !this.isCompact
    },
    rootClasses() {
      return {
        panel: !this.isCompact,
        'donut-chart--compact': this.isCompact,
        'donut-chart--expanded': this.expanded
      }
    },
    periodLabel() {
      return this.period === 'ytd' ? 'YTD' : 'MTD'
    },
    emptyLabel() {
      if (this.isCompact) return 'No spending'
      return this.period === 'ytd' ? 'No spending this year' : 'No spending this month'
    }
  },
  watch: {
    byCategory: {
      deep: true,
      handler() {
        this.scheduleRender()
      }
    },
    expanded() {
      this.scheduleRender()
    },
    topN() {
      this.scheduleRender()
    },
    variant() {
      this.scheduleRender()
    },
    selectedCategory: {
      handler() {
        this.syncSelectedIndex()
      },
      immediate: true
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

      const limit = this.expanded ? entries.length : this.topN
      const top = entries.slice(0, limit)
      const rest = this.expanded ? [] : entries.slice(limit)
      const otherSpend = rest.reduce((sum, [, v]) => sum + v.spend, 0)

      const labels = top.map(([k]) => k.replace(/_/g, ' '))
      const values = top.map(([, v]) => v.spend / 100)
      this._segmentKeys = top.map(([k]) => k)

      if (otherSpend > 0) {
        labels.push('Other')
        values.push(otherSpend / 100)
        this._segmentKeys.push('other')
      }

      this.totalSpend = entries.reduce((sum, [, v]) => sum + v.spend, 0)
      const colors = chartColors.donut.slice(0, labels.length)
      this.legendItems = labels.map((label, i) => ({ label, color: colors[i] }))
      return { labels, values, colors }
    },
    syncSelectedIndex() {
      const keys = this._segmentKeys || []
      if (!this.selectedCategory) {
        this.selectedIndex = null
        return
      }
      if (!keys.length) {
        this.selectedIndex = null
        return
      }
      if (this.selectedCategory === 'other' || Array.isArray(this.selectedCategory)) {
        this.selectedIndex = keys.indexOf('other')
        return
      }
      this.selectedIndex = keys.indexOf(this.selectedCategory)
    },
    emitCategory(index) {
      const key = this._segmentKeys[index]
      if (!key) return
      this.selectedIndex = index
      if (key === 'other') {
        this.$emit('select-category', {
          category: 'other',
          categories: otherCategoryKeys(this.byCategory, this.topN),
          label: 'Other'
        })
        return
      }
      this.$emit('select-category', {
        category: key,
        label: key.replace(/_/g, ' ')
      })
    },
    onLegendClick(index) {
      this.emitCategory(index)
    },
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

      const { labels, values, colors } = this.buildSegments()

      if (!labels.length) {
        this.legendItems = []
        this._chart = destroyChart(this._chart)
        return
      }

      const onClick = onChartSelect(({ index }) => this.emitCategory(index))
      const cutout = this.isCompact ? '72%' : '68%'

      const container = this.$refs.canvasEl?.parentElement
      if (!this._chart && !isChartContainerSized(container)) {
        return
      }

      if (this._chart) {
        this._chart.data.labels = labels
        this._chart.data.datasets[0].data = values
        this._chart.data.datasets[0].backgroundColor = colors
        this._chart.options.onClick = onClick
        this._chart.options.cutout = cutout
        this._chart.update('none')
        this._chart.resize()
        this.syncSelectedIndex()
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
            hoverOffset: this.isCompact ? 3 : 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout,
          onClick,
          layout: {
            padding: this.isCompact
              ? { left: 2, right: 2, top: 2, bottom: 2 }
              : { left: 4, right: 4, top: 4, bottom: 4 }
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
      this.syncSelectedIndex()
    }
  }
}
</script>

<style scoped>
.donut-chart {
  background: var(--sw-panel);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.donut-chart--compact {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
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

.donut-chart__wrap--compact {
  height: 100px;
}

.donut-chart--expanded .donut-chart__wrap {
  height: 320px;
}

.donut-chart__canvas {
  width: 100%;
  max-width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  contain: layout paint;
}

.donut-chart__center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.donut-chart__center--compact {
  max-width: 72%;
}

.donut-chart__legend {
  list-style: none;
  margin: 0.65rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.donut-chart__legend--compact {
  margin: 0.35rem 0 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.2rem 0.5rem;
}

.donut-chart__legend--compact.donut-chart__legend--hide-center {
  margin: 0.5rem 0 0;
  gap: 0.3rem 0.6rem;
}

.donut-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--sw-text-secondary);
  min-width: 0;
  cursor: pointer;
  border-radius: 4px;
  padding: 0.15rem 0.25rem;
}

.donut-chart__legend--compact .donut-chart__legend-item {
  font-size: 0.65rem;
  padding: 0.1rem 0.15rem;
}

.donut-chart__legend--compact.donut-chart__legend--hide-center .donut-chart__legend-item {
  font-size: 0.7rem;
}

.donut-chart__legend-item:hover,
.donut-chart__legend-item.active {
  background: var(--sw-panel-inset);
  color: var(--sw-text-primary);
}

.donut-chart__swatch {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.donut-chart__legend--compact .donut-chart__swatch {
  width: 6px;
  height: 6px;
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

.donut-chart__center-value--compact {
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.donut-chart__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

.donut-chart--compact .donut-chart__empty {
  font-size: 0.7rem;
}

.muted { color: var(--sw-text-muted); }
</style>
