import { describe, expect, it } from 'vitest'
import type { PeakRule } from '../types'
import { computeCost, formatCost, isPeakTime } from './cost'

const price = { in: 2, out: 8, cacheHit: 0.2 } // 元/百万 token（示例）
const peak: PeakRule = {
  enabled: true,
  multiplier: 2,
  peaks: [{ start: '09:00', end: '12:00' }],
}
const peakTime = new Date('2026-01-01T10:00:00')
const offPeakTime = new Date('2026-01-01T13:00:00')

describe('computeCost', () => {
  it('区分缓存命中/未命中', () => {
    const cost = computeCost(
      {
        promptTokens: 1000,
        completionTokens: 500,
        promptCacheHitTokens: 800,
        promptCacheMissTokens: 200,
      },
      price,
    )
    // (800×0.2 + 200×2 + 500×8) / 1e6 = (160 + 400 + 4000)/1e6
    expect(cost).toBeCloseTo(0.00456, 8)
  })

  it('无缓存字段时全部按未命中兜底', () => {
    const cost = computeCost({ promptTokens: 1000, completionTokens: 500 }, price)
    expect(cost).toBeCloseTo(0.006, 8)
  })

  it('高峰时段费用按乘数翻倍', () => {
    const cost = computeCost({ promptTokens: 1000, completionTokens: 500 }, price, peak, peakTime)
    expect(cost).toBeCloseTo(0.012, 8)
  })

  it('平峰时段不翻倍', () => {
    const cost = computeCost({ promptTokens: 1000, completionTokens: 500 }, price, peak, offPeakTime)
    expect(cost).toBeCloseTo(0.006, 8)
  })

  it('未启用峰谷规则不翻倍', () => {
    const cost = computeCost(
      { promptTokens: 1000, completionTokens: 500 },
      price,
      { ...peak, enabled: false },
      peakTime,
    )
    expect(cost).toBeCloseTo(0.006, 8)
  })
})

describe('isPeakTime', () => {
  it('高峰区间内 true', () => {
    expect(isPeakTime(new Date('2026-01-01T10:30:00'), peak)).toBe(true)
  })
  it('end 时刻不含', () => {
    expect(isPeakTime(new Date('2026-01-01T12:00:00'), peak)).toBe(false)
  })
  it('区间外 false', () => {
    expect(isPeakTime(new Date('2026-01-01T08:59:00'), peak)).toBe(false)
  })
  it('未启用 false', () => {
    expect(isPeakTime(peakTime, { ...peak, enabled: false })).toBe(false)
  })
  it('非法时段字符串不抛错', () => {
    expect(isPeakTime(peakTime, { ...peak, peaks: [{ start: 'x', end: 'y' }] })).toBe(false)
  })
})

describe('formatCost', () => {
  it('≥0.01 用 4 位小数', () => {
    expect(formatCost(0.00456)).toBe('¥0.00456')
  })
  it('极小金额用 6 位，不再显示 ¥0', () => {
    expect(formatCost(0.00002)).toBe('¥0.00002')
  })
  it('整数去尾零', () => {
    expect(formatCost(5)).toBe('¥5')
    expect(formatCost(0.5)).toBe('¥0.5')
  })
  it('零显示 ¥0', () => {
    expect(formatCost(0)).toBe('¥0')
  })
})
