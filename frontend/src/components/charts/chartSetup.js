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

export function createChart(ctx, config) {
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

export function observeChartResize(containerEl, getChart) {
  if (!containerEl || typeof ResizeObserver === 'undefined') return null

  let frame = null
  const observer = new ResizeObserver(() => {
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = null
      getChart()?.resize()
    })
  })
  observer.observe(containerEl)
  return observer
}
