import { describe, expect, it } from 'vitest'
import { normalizeModel } from './model'

describe('normalizeModel', () => {
  it('已弃用模型映射到 v4-flash（2026-07-24 下线）', () => {
    expect(normalizeModel('deepseek-chat')).toBe('deepseek-v4-flash')
    expect(normalizeModel('deepseek-reasoner')).toBe('deepseek-v4-flash')
  })
  it('新模型原样返回', () => {
    expect(normalizeModel('deepseek-v4-flash')).toBe('deepseek-v4-flash')
    expect(normalizeModel('deepseek-v4-pro')).toBe('deepseek-v4-pro')
  })
  it('自定义模型原样返回', () => {
    expect(normalizeModel('my-custom-model')).toBe('my-custom-model')
  })
})
