import { describe, expect, it } from 'vitest'
import { normalizeUsage, parseSseLine } from './deepseek'

describe('normalizeUsage', () => {
  it('解析 DeepSeek usage（含缓存字段）', () => {
    const u = normalizeUsage({
      prompt_tokens: 8,
      completion_tokens: 28,
      total_tokens: 36,
      prompt_cache_hit_tokens: 6,
      prompt_cache_miss_tokens: 2,
    })
    expect(u).toEqual({
      promptTokens: 8,
      completionTokens: 28,
      totalTokens: 36,
      promptCacheHitTokens: 6,
      promptCacheMissTokens: 2,
    })
  })
  it('无缓存字段时返回 undefined 字段', () => {
    const u = normalizeUsage({ prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 })
    expect(u?.promptCacheHitTokens).toBeUndefined()
  })
  it('undefined 输入返回 undefined', () => {
    expect(normalizeUsage(undefined)).toBeUndefined()
  })
})

describe('parseSseLine', () => {
  it('解析 data payload', () => {
    expect(parseSseLine('data: {"choices":[{}]}')).toBe('{"choices":[{}]}')
  })
  it('解析 [DONE]', () => {
    expect(parseSseLine('data: [DONE]')).toBe('[DONE]')
  })
  it('非 data 行返回 null', () => {
    expect(parseSseLine('event: x')).toBeNull()
    expect(parseSseLine('')).toBeNull()
  })
  it('容忍前导空白', () => {
    expect(parseSseLine('  data: x')).toBe('x')
  })
})
