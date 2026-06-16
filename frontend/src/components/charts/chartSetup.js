import { markRaw } from 'vue'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  ArcElement,
  DoughnutController,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'

let registered = false

export function ensureChartsRegistered() {
  if (registered) return
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    BarController,
    BarElement,
    ArcElement,
    DoughnutController,
    Filler,
    Tooltip,
    Legend
  )
  registered = true
}

export function isChartContainerSized(containerEl) {
  if (!containerEl) return false
  const { width, height } = containerEl.getBoundingClientRect()
  return width > 0 && height > 0
}

export function destroyChartOnCanvas(canvas) {
  if (!canvas) return
  const existing = Chart.getChart(canvas)
  if (existing) {
    existing.stop()
    existing.destroy()
  }
}

export function createChart(ctx, config) {
  destroyChartOnCanvas(ctx?.canvas)
  return markRaw(new Chart(ctx, config))
}

export function destroyChart(chart) {
  if (!chart) return null
  chart.stop()
  chart.destroy()
  return null
}

export function getCanvasContext(canvasEl) {
  return canvasEl?.getContext('2d') ?? null
}

export function onChartSelect(handler) {
  return (_event, elements, chart) => {
    if (!elements?.length) return
    const { index } = elements[0]
    handler({ index, label: chart.data.labels?.[index] })
  }
}

export function observeChartResize(containerEl, getChartOrOpts) {
  if (!containerEl || typeof ResizeObserver === 'undefined') return null

  const opts = typeof getChartOrOpts === 'function'
    ? { getChart: getChartOrOpts }
    : getChartOrOpts || {}
  const { getChart, onLayout } = opts

  let frame = null
  const observer = new ResizeObserver(() => {
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = null
      const chart = getChart?.()
      if (chart) chart.resize()
      onLayout?.()
    })
  })
  observer.observe(containerEl)
  return observer
}
