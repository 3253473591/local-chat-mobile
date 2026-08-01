import { describe, expect, it } from 'vitest'
import { buildChatBody, normalizeUsage, parseSseLine } from './deepseek'

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
  it('解析思维链 token 数（completion_tokens_details.reasoning_tokens）', () => {
    const u = normalizeUsage({
      prompt_tokens: 5,
      completion_tokens: 10,
      total_tokens: 15,
      completion_tokens_details: { reasoning_tokens: 7 },
    })
    expect(u?.reasoningTokens).toBe(7)
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

describe('buildChatBody', () => {
  const base = { model: 'deepseek-v4-pro', messages: [{ role: 'user' as const, content: 'hi' }] }

  it('思考模式只发 thinking + reasoning_effort，绝不携带 temperature/top_p', () => {
    const body = buildChatBody({ ...base, thinking: true, reasoningEffort: 'high', temperature: 0.7, topP: 0.9 })
    expect(body.thinking).toEqual({ type: 'enabled' })
    expect(body.reasoning_effort).toBe('high')
    expect(body.temperature).toBeUndefined()
    expect(body.top_p).toBeUndefined()
  })

  it('非思考模式发 temperature + top_p，不携带 reasoning_effort', () => {
    const body = buildChatBody({ ...base, thinking: false, reasoningEffort: 'high', temperature: 0.7, topP: 0.9 })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.temperature).toBe(0.7)
    expect(body.top_p).toBe(0.9)
    expect(body.reasoning_effort).toBeUndefined()
  })

  it('未设置 temperature/topP 时请求体不出现这些字段', () => {
    const body = buildChatBody({ ...base, thinking: false })
    expect(body.temperature).toBeUndefined()
    expect(body.top_p).toBeUndefined()
  })

  it('思考模式未指定 effort 时不发送 reasoning_effort（用 API 默认 high）', () => {
    const body = buildChatBody({ ...base, thinking: true })
    expect(body.reasoning_effort).toBeUndefined()
    expect(body.thinking).toEqual({ type: 'enabled' })
  })
})
