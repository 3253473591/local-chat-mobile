import { beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { db } from './index'
import {
  applyMessageChanges,
  deleteConversation,
  deleteMessages,
  loadConversations,
  loadMessages,
  loadSettings,
  saveConversation,
  saveSettings,
  upsertNodes,
} from './repository'
import { deleteRound } from '../core/tree'
import type { Conversation, GlobalSettings, MessageNode } from '../types'

const conv: Conversation = {
  id: 'c1',
  title: '测试对话',
  model: 'deepseek-chat',
  prompt: '',
  regex: '',
  regexReplacement: '',
  xRounds: 8,
  activePath: [],
  createdAt: 1,
  updatedAt: 2,
}

const node: MessageNode = {
  id: 'n1',
  conversationId: 'c1',
  role: 'user',
  parentId: null,
  content: 'hi',
  versionIndex: 1,
  createdAt: 1,
  updatedAt: 1,
}

const settings: GlobalSettings = {
  apiKey: 'sk-test',
  defaultModel: 'deepseek-reasoner',
  models: ['deepseek-chat', 'deepseek-reasoner'],
  costTracking: true,
  prompt: '',
  regex: '',
  regexReplacement: '',
  xRounds: 4,
  bgImage: '',
  avatar: '',
  userAvatar: '',
  thinkingEnabled: true,
  reasoningEffort: 'high',
  temperature: null,
  topP: null,
  peakRule: {
    enabled: false,
    multiplier: 2,
    peaks: [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
  },
  prices: { 'deepseek-chat': { in: 2, out: 8, cacheHit: 0.2 } },
}

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

describe('repository 持久化（含响应式 Proxy 剥离）', () => {
  it('settings 写入读取往返（普通对象）', async () => {
    await saveSettings(settings)
    const loaded = await loadSettings()
    expect(loaded?.apiKey).toBe('sk-test')
    expect(loaded?.defaultModel).toBe('deepseek-reasoner')
    expect(loaded?.models).toEqual(['deepseek-chat', 'deepseek-reasoner'])
    expect(loaded?.prices['deepseek-chat']).toEqual({ in: 2, out: 8, cacheHit: 0.2 })
  })

  it('settings 写入读取往返（Vue reactive Proxy）—— 修复前会 DataCloneError', async () => {
    await saveSettings(reactive(settings))
    const loaded = await loadSettings()
    expect(loaded?.apiKey).toBe('sk-test')
  })

  it('conversation 写入读取往返（reactive）', async () => {
    await saveConversation(reactive(conv))
    const list = await loadConversations()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('c1')
  })

  it('消息批量写入读取与删除（reactive）', async () => {
    await upsertNodes([reactive(node)])
    const msgs = await loadMessages('c1')
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('hi')
    await deleteMessages(['n1'])
    expect(await loadMessages('c1')).toHaveLength(0)
  })

  it('删除对话连带清空消息', async () => {
    await saveConversation(conv)
    await upsertNodes([node])
    await deleteConversation('c1')
    expect(await loadConversations()).toHaveLength(0)
    expect(await loadMessages('c1')).toHaveLength(0)
  })

  it('deleteRound 全流程：删 U2 后重挂 U3，重新加载后 U3/A3 仍在', async () => {
    // U1 → A1 → U2 → A2 → U3 → A3，全部写入 DB
    const nodes: MessageNode[] = [
      { id: 'U1', conversationId: 'c1', role: 'user', parentId: null, content: 'q1', versionIndex: 1, createdAt: 1, updatedAt: 1 },
      { id: 'A1', conversationId: 'c1', role: 'assistant', parentId: 'U1', content: 'a1', versionIndex: 1, createdAt: 2, updatedAt: 2 },
      { id: 'U2', conversationId: 'c1', role: 'user', parentId: 'A1', content: 'q2', versionIndex: 1, createdAt: 3, updatedAt: 3 },
      { id: 'A2', conversationId: 'c1', role: 'assistant', parentId: 'U2', content: 'a2', versionIndex: 1, createdAt: 4, updatedAt: 4 },
      { id: 'U3', conversationId: 'c1', role: 'user', parentId: 'A2', content: 'q3', versionIndex: 1, createdAt: 5, updatedAt: 5 },
      { id: 'A3', conversationId: 'c1', role: 'assistant', parentId: 'U3', content: 'a3', versionIndex: 1, createdAt: 6, updatedAt: 6 },
    ]
    await upsertNodes(nodes)

    const original = Object.fromEntries(nodes.map((item) => [item.id, item]))
    const after = deleteRound(original, 'U2')
    const rehomed = Object.values(after).filter(
      (item) => original[item.id]?.parentId !== item.parentId,
    )
    await applyMessageChanges(rehomed, ['U2', 'A2'])

    // 重新加载：U3/A3 必须在
    const loaded = await loadMessages('c1')
    const map: Record<string, MessageNode> = {}
    for (const m of loaded) map[m.id] = m

    expect(map.U1).toBeDefined()
    expect(map.A1).toBeDefined()
    expect(map.U2).toBeUndefined()
    expect(map.A2).toBeUndefined()
    expect(map.U3).toBeDefined()
    expect(map.A3).toBeDefined()
    expect(map.U3.parentId).toBe('A1') // 重挂成功
    expect(map.A3.parentId).toBe('U3') // 未变
  })
})
