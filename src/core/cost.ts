import type { ModelPrice, PeakRule } from '../types'

/**
 * 费用计算 —— 区分提示词缓存命中/未命中（实测确认 usage 含该字段）。
 * 支持分时段计费（DeepSeek 高峰时段价格翻倍）。
 * 价格单位：元 / 百万 token。
 */

export interface UsageInput {
  promptTokens: number
  completionTokens: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
}

/** 折算为元；peak/when 传入时按生成时刻判断是否高峰 */
export function computeCost(
  usage: UsageInput,
  price: ModelPrice,
  peak?: PeakRule,
  when?: Date,
): number {
  let base: number
  if (usage.promptCacheHitTokens === undefined && usage.promptCacheMissTokens === undefined) {
    // 无缓存字段时兜底：全部按未命中算
    base = (usage.promptTokens * price.in + usage.completionTokens * price.out) / 1e6
  } else {
    const hit = (usage.promptCacheHitTokens ?? 0) * price.cacheHit
    const miss = (usage.promptCacheMissTokens ?? 0) * price.in
    base = (hit + miss + usage.completionTokens * price.out) / 1e6
  }
  if (peak && when && isPeakTime(when, peak)) {
    return base * peak.multiplier
  }
  return base
}

/** 判断某时刻是否处于高峰时段（本地时间，HH:mm，end 不含） */
export function isPeakTime(when: Date, rule: PeakRule): boolean {
  if (!rule.enabled || rule.peaks.length === 0) return false
  const m = when.getHours() * 60 + when.getMinutes()
  return rule.peaks.some((p) => {
    const s = parseHM(p.start)
    const e = parseHM(p.end)
    return s !== null && e !== null && m >= s && m < e
  })
}

function parseHM(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** 金额格式化：≥0.01 元 4 位小数，更小 6 位；极小金额不再显示 ¥0 */
export function formatCost(yuan: number): string {
  if (yuan <= 0) return '¥0'
  const digits = yuan >= 0.01 ? 4 : 6
  return `¥${yuan.toFixed(digits).replace(/\.?0+$/, '')}`
}
