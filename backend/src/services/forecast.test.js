import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  averageBaseline,
  averageMonthlyNet,
  applyYtdPaceWhenFlat,
  baselineFromTargetNet,
  buildHorizons,
  computeYtdMonthlyNet,
  isInformativeBaseline,
  resolveBaseline,
  resolvePotBaseline
} from './forecast.js'

describe('averageMonthlyNet', () => {
  it('averages net directly instead of cancelling spend and income', () => {
    const baselines = [
      { spend: 1000, income: 1200, net: 200 },
      { spend: 900, income: 1100, net: 200 },
      { spend: 1100, income: 1300, net: 200 }
    ]
    assert.equal(averageMonthlyNet(baselines), 200)
    assert.equal(averageBaseline(baselines).net, 200)
  })

  it('differs from averageBaseline when months offset', () => {
    const baselines = [
      { spend: 1000, income: 1500, net: 500 },
      { spend: 1500, income: 1000, net: -500 }
    ]
    assert.equal(averageMonthlyNet(baselines), 0)
    assert.equal(averageBaseline(baselines).net, 0)
  })

  it('preserves non-zero average when spend and income cancel in averageBaseline', () => {
    const baselines = [
      { spend: 2000, income: 2500, net: 500 },
      { spend: 2500, income: 2000, net: -500 }
    ]
    assert.equal(averageMonthlyNet(baselines), 0)
    const avg = averageBaseline(baselines)
    assert.equal(avg.spend, 2250)
    assert.equal(avg.income, 2250)
    assert.equal(avg.net, 0)
  })
})

describe('resolveBaseline', () => {
  const availableBaselines = [{ spend: 1000, income: 1200, net: 200 }]

  it('uses prior-year baseline when available', () => {
    const baselineByKey = new Map([['2025-06', { spend: 80000, income: 100000, net: 20000 }]])
    const resolved = resolveBaseline({
      baselineKey: '2025-06',
      baselineByKey,
      olderCacheByKey: new Map(),
      availableBaselines,
      ytdMonthlyNet: 15000
    })
    assert.equal(resolved.source, 'priorYear')
    assert.equal(resolved.net, 20000)
  })

  it('skips break-even prior-year baseline and uses ytd pace', () => {
    const baselineByKey = new Map([
      ['2025-07', { spend: 200000, income: 200000, net: 0 }]
    ])
    const resolved = resolveBaseline({
      baselineKey: '2025-07',
      baselineByKey,
      olderCacheByKey: new Map(),
      availableBaselines,
      ytdMonthlyNet: 14716
    })
    assert.equal(resolved.source, 'ytdPace')
    assert.equal(resolved.net, 14716)
  })

  it('skips low-activity prior-year baseline and uses ytd pace', () => {
    const baselineByKey = new Map([['2025-08', { spend: 100, income: 200, net: 100 }]])
    const resolved = resolveBaseline({
      baselineKey: '2025-08',
      baselineByKey,
      olderCacheByKey: new Map(),
      availableBaselines,
      ytdMonthlyNet: 12000
    })
    assert.equal(resolved.source, 'ytdPace')
    assert.equal(resolved.net, 12000)
  })

  it('prefers older cache over ytd pace', () => {
    const baselineByKey = new Map([['2025-06', null]])
    const olderCacheByKey = new Map([
      ['2025-07', { spend: 70000, income: 90000, net: 20000 }]
    ])
    const resolved = resolveBaseline({
      baselineKey: '2025-07',
      baselineByKey,
      olderCacheByKey,
      availableBaselines,
      ytdMonthlyNet: 15000
    })
    assert.equal(resolved.source, 'olderCache')
    assert.equal(resolved.net, 20000)
  })

  it('uses ytd pace when prior year and cache are missing', () => {
    const baselineByKey = new Map()
    const resolved = resolveBaseline({
      baselineKey: '2025-08',
      baselineByKey,
      olderCacheByKey: new Map(),
      availableBaselines,
      ytdMonthlyNet: 150
    })
    assert.equal(resolved.source, 'ytdPace')
    assert.equal(resolved.net, 150)
  })

  it('falls back to average monthly net when ytd pace is zero', () => {
    const baselineByKey = new Map()
    const baselines = [
      { spend: 1000, income: 1300, net: 300 },
      { spend: 900, income: 1500, net: 600 }
    ]
    const resolved = resolveBaseline({
      baselineKey: '2025-09',
      baselineByKey,
      olderCacheByKey: new Map(),
      availableBaselines: baselines,
      ytdMonthlyNet: 0
    })
    assert.equal(resolved.source, 'avgNet')
    assert.equal(resolved.net, 450)
  })
})

describe('resolvePotBaseline', () => {
  it('uses ytd pot pace when prior year is missing', () => {
    const potBaselines = new Map()
    const resolved = resolvePotBaseline({
      baselineKey: '2025-07',
      potBaselines,
      olderPotCacheByKey: new Map(),
      availablePotBaselines: [{ deposits: 500, withdrawals: 100, net: 400 }],
      ytdMonthlyPotNet: 80
    })
    assert.equal(resolved.source, 'ytdPace')
    assert.equal(resolved.net, 80)
  })
})

describe('isInformativeBaseline', () => {
  it('rejects empty and break-even months', () => {
    assert.equal(isInformativeBaseline(null), false)
    assert.equal(isInformativeBaseline({ spend: 0, income: 0, net: 0 }), false)
    assert.equal(isInformativeBaseline({ spend: 200000, income: 200000, net: 0 }), false)
  })

  it('accepts months with meaningful net', () => {
    assert.equal(isInformativeBaseline({ spend: 80000, income: 100000, net: 20000 }), true)
  })
})

describe('applyYtdPaceWhenFlat', () => {
  it('replaces flat seasonal projection with ytd monthly net', () => {
    const projected = { spend: 200000, income: 200000, net: 0 }
    const adjusted = applyYtdPaceWhenFlat(projected, {
      isCurrent: false,
      baselineSource: 'priorYear',
      ytdMonthlyNet: 14716
    })
    assert.equal(adjusted.net, 14716)
  })

  it('leaves current month untouched', () => {
    const projected = { spend: 100, income: 200, net: 100 }
    const adjusted = applyYtdPaceWhenFlat(projected, {
      isCurrent: true,
      baselineSource: 'priorYear',
      ytdMonthlyNet: 14716
    })
    assert.equal(adjusted.net, 100)
  })
})

describe('computeYtdMonthlyNet', () => {
  it('weights recent months more heavily', () => {
    const txs = [
      { amount: 10000, created: '2026-01-15T12:00:00Z' },
      { amount: -5000, created: '2026-02-10T12:00:00Z' },
      { amount: 20000, created: '2026-03-20T12:00:00Z' },
      { amount: -3000, created: '2026-04-05T12:00:00Z' },
      { amount: 30000, created: '2026-05-25T12:00:00Z' },
      { amount: -4000, created: '2026-06-12T12:00:00Z' }
    ]
    const net = computeYtdMonthlyNet(txs, 2026, 5, new Set(), [])
    assert.ok(net > 0)
  })
})

describe('buildHorizons', () => {
  it('produces diverging horizons when monthly nets differ', () => {
    const monthlyProjections = [
      { projected: { net: 150 } },
      { projected: { net: 100 } },
      { projected: { net: 100 } },
      { projected: { net: 50 } },
      { projected: { net: 50 } },
      { projected: { net: 50 } },
      { projected: { net: 200 } },
      { projected: { net: 200 } },
      { projected: { net: 200 } },
      { projected: { net: 200 } },
      { projected: { net: 200 } },
      { projected: { net: 200 } }
    ]
    const horizons = buildHorizons(monthlyProjections, 0)
    assert.equal(horizons[1].projectedNet, 150)
    assert.equal(horizons[3].projectedNet, 350)
    assert.equal(horizons[6].projectedNet, 500)
    assert.equal(horizons[12].projectedNet, 1700)
    assert.ok(horizons[1].projectedNet < horizons[3].projectedNet)
    assert.ok(horizons[3].projectedNet < horizons[6].projectedNet)
    assert.ok(horizons[6].projectedNet < horizons[12].projectedNet)
  })

  it('scales horizons when flat months are filled by ytd pace', () => {
    const monthlyProjections = Array.from({ length: 12 }, (_, i) => ({
      projected: { net: i === 0 ? 14716 : 14716 }
    }))
    const horizons = buildHorizons(monthlyProjections, 0)
    assert.equal(horizons[1].projectedNet, 14716)
    assert.equal(horizons[3].projectedNet, 14716 * 3)
    assert.equal(horizons[6].projectedNet, 14716 * 6)
    assert.equal(horizons[12].projectedNet, 14716 * 12)
  })

  it('collapses short horizons when intermediate months are zero', () => {
    const monthlyProjections = [
      { projected: { net: 147 } },
      { projected: { net: 0 } },
      { projected: { net: 0 } },
      { projected: { net: 0 } },
      { projected: { net: 0 } },
      { projected: { net: 0 } },
      { projected: { net: 177 } },
      { projected: { net: 177 } },
      { projected: { net: 177 } },
      { projected: { net: 177 } },
      { projected: { net: 177 } },
      { projected: { net: 177 } }
    ]
    const horizons = buildHorizons(monthlyProjections, 0)
    assert.equal(horizons[1].projectedNet, 147)
    assert.equal(horizons[3].projectedNet, 147)
    assert.equal(horizons[6].projectedNet, 147)
    assert.ok(horizons[12].projectedNet > horizons[6].projectedNet)
  })
})

describe('baselineFromTargetNet', () => {
  it('scales spend and income from a reference baseline', () => {
    const reference = { spend: 1000, income: 1500, net: 500 }
    const derived = baselineFromTargetNet(250, reference)
    assert.equal(derived.net, 250)
    assert.equal(derived.spend, 500)
    assert.equal(derived.income, 750)
  })
})
