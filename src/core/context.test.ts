import { describe, expect, it } from 'vitest'
import { applyRegex, buildMessages, collectPairs } from './context'
import { appendTo, createNode, type NodeMap } from './tree'

const CONV = 'conv1'

function user(id: string, parentId: string | null, content: string, nodes: NodeMap) {
  return createNode(nodes, { conversationId: CONV, parentId, role: 'user', content, id })
}
function asst(id: string, parentId: string, content: string, nodes: NodeMap) {
  return createNode(nodes, { conversationId: CONV, parentId, role: 'assistant', content, id })
}

/** 路径 根→U1→R1a→U2→R2 */
function buildNodes() {
  let nodes: NodeMap = {}
  nodes = appendTo(nodes, user('U1', null, 'A', nodes))
  nodes = appendTo(nodes, asst('R1a', 'U1', 'a', nodes))
  nodes = appendTo(nodes, user('U2', 'R1a', 'B', nodes))
  nodes = appendTo(nodes, asst('R2', 'U2', 'b', nodes))
  return nodes
}

describe('collectPairs 沿路径取 X 对', () => {
  const nodes = buildNodes()

  it('取最近 X 对（保持对话顺序）', () => {
    const pairs = collectPairs(nodes, ['U1', 'R1a', 'U2', 'R2'], 8)
    expect(pairs.map((n) => n.id)).toEqual(['U1', 'R1a', 'U2', 'R2'])
  })

  it('X 截断：只取最近 1 对', () => {
    const pairs = collectPairs(nodes, ['U1', 'R1a', 'U2', 'R2'], 1)
    expect(pairs.map((n) => n.id)).toEqual(['U2', 'R2'])
  })

  it('尾部为待回复 user（不参与配对）', () => {
    const pairs = collectPairs(nodes, ['U1', 'R1a', 'U2'], 8)
    expect(pairs.map((n) => n.id)).toEqual(['U1', 'R1a'])
  })

  it('跳过进行中/未完成的空 assistant（刚创建待流式）', () => {
    // path 末尾是刚创建的空 assistant 节点
    let m: NodeMap = nodes
    m = appendTo(m, asst('Empty', 'U2', '', m))
    const pairs = collectPairs(m, ['U1', 'R1a', 'U2', 'Empty'], 8)
    expect(pairs.map((n) => n.id)).toEqual(['U1', 'R1a'])
  })

  it('暂停后的部分回复（非空）作为历史参与配对', () => {
    let m: NodeMap = nodes
    m = appendTo(m, asst('Partial', 'U2', '部分内容', m))
    const pairs = collectPairs(m, ['U1', 'R1a', 'U2', 'Partial'], 8)
    expect(pairs.map((n) => n.id)).toEqual(['U1', 'R1a', 'U2', 'Partial'])
  })
})

describe('buildMessages 组装', () => {
  const nodes = buildNodes()

  it('系统提示词 + X 对历史 + 当前输入', () => {
    const msgs = buildMessages(nodes, ['U1', 'R1a', 'U2'], {
      xRounds: 8,
      prompt: '你是助手',
      currentUserContent: 'B',
    })
    expect(msgs).toEqual([
      { role: 'system', content: '你是助手' },
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'B' },
    ])
  })

  it('无提示词时省略 system', () => {
    const msgs = buildMessages(nodes, ['U1'], { xRounds: 8, prompt: '', currentUserContent: 'A' })
    expect(msgs).toEqual([{ role: 'user', content: 'A' }])
  })

  it('X=0 只发当前输入', () => {
    const msgs = buildMessages(nodes, ['U1', 'R1a', 'U2', 'R2'], {
      xRounds: 0,
      prompt: '',
      currentUserContent: 'B',
    })
    expect(msgs).toEqual([{ role: 'user', content: 'B' }])
  })
})

describe('applyRegex', () => {
  it('纯 pattern 全局替换', () => {
    expect(applyRegex('hello world world', 'world', 'X')).toBe('hello X X')
  })
  it('/pattern/flags 形式', () => {
    expect(applyRegex('aa bb AA', '/a+/gi', 'x')).toBe('x bb x')
  })
  it('捕获组 replacement', () => {
    expect(applyRegex('日期 2026-07-31', '/(\\d{4})-(\\d{2})-(\\d{2})/', '$1年$2月$3日')).toBe('日期 2026年07月31日')
  })
  it('空 pattern 原样返回', () => {
    expect(applyRegex('abc', '')).toBe('abc')
  })
  it('非法 pattern 原样返回', () => {
    expect(applyRegex('abc', '([invalid')).toBe('abc')
  })
})
