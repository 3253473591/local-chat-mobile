import { afterEach, describe, expect, it } from 'vitest'
import { genId } from './id'

const desc = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')

afterEach(() => {
  if (desc) Object.defineProperty(crypto, 'randomUUID', desc)
})

describe('genId', () => {
  it('返回非空字符串', () => {
    expect(genId()).toBeTruthy()
  })
  it('多次调用唯一', () => {
    const ids = new Set([genId(), genId(), genId()])
    expect(ids.size).toBe(3)
  })
  it('randomUUID 不可用（局域网 HTTP 场景）时降级', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    expect(genId()).toMatch(/^id-/)
  })
})
