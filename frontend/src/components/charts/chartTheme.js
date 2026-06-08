import { designTokens as t } from '../../assets/designTokens.js'

export const chartColors = {
  income: t.accentGreen,
  spend: t.dangerSoft,
  primary: t.blueBright,
  secondary: t.blueMid,
  tertiary: t.accentOrange,
  quaternary: t.blueMuted,
  donut: [t.blueBright, t.blueMid, t.accentOrange, t.blueMuted, t.accentGreen, t.accentOrangeSoft, t.dangerSoft, t.info]
}

export function rgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function gridColor() {
  return rgba(t.border, 0.5)
}

export function tooltipConfig() {
  return {
    backgroundColor: t.panel,
    titleColor: t.textPrimary,
    bodyColor: t.textSecondary,
    borderColor: t.border,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8
  }
}

export function axisTicks() {
  return { color: t.textSecondary, font: { size: 11 } }
}

export function axisGrid() {
  return { color: gridColor() }
}

export function lineDataset(label, data, color, { fill = true } = {}) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: fill ? rgba(color, 0.15) : 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.35,
    fill
  }
}

export function formatPenceTooltip(value) {
  return `£${(value / 100).toFixed(2)}`
}

export function formatPoundsTooltip(value) {
  return `£${Number(value).toFixed(2)}`
}
