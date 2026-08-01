import { db, type SettingsRow } from './index'
import type { Conversation, GlobalSettings, MessageNode } from '../types'

export const SETTINGS_KEY = 'global'

/**
 * 剥离 Vue 响应式代理 → 纯普通对象。
 * 直接存入 IndexedDB 时，reactive Proxy 无法被 structured clone（DataCloneError）。
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/** 对话列表（按更新时间倒序） */
export async function loadConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy('updatedAt').reverse().toArray()
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id)
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await db.conversations.put(toPlain(conv))
}

/** 删除对话及其全部消息 */
export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.conversations.delete(id)
    await db.messages.where('conversationId').equals(id).delete()
  })
}

/** 加载某对话的全部节点 */
export async function loadMessages(conversationId: string): Promise<MessageNode[]> {
  return db.messages.where('conversationId').equals(conversationId).toArray()
}

/** 批量写入节点（新增/更新） */
export async function upsertNodes(nodes: MessageNode[]): Promise<void> {
  if (nodes.length === 0) return
  await db.messages.bulkPut(nodes.map((n) => toPlain(n)))
}

/** 批量删除节点 */
export async function deleteMessages(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.messages.bulkDelete(ids)
}

/** 在同一事务中保存重挂节点并删除旧节点，避免对话树只完成一半更新。 */
export async function applyMessageChanges(
  upserts: MessageNode[],
  deletedIds: string[],
): Promise<void> {
  if (upserts.length === 0 && deletedIds.length === 0) return
  await db.transaction('rw', db.messages, async () => {
    if (upserts.length > 0) {
      await db.messages.bulkPut(upserts.map((node) => toPlain(node)))
    }
    if (deletedIds.length > 0) {
      await db.messages.bulkDelete(deletedIds)
    }
  })
}

export async function loadSettings(): Promise<GlobalSettings | null> {
  const row = await db.settings.get(SETTINGS_KEY)
  if (!row) return null
  const { key: _key, ...settings } = row
  return settings
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  const row: SettingsRow = { key: SETTINGS_KEY, ...toPlain(settings) }
  await db.settings.put(toPlain(row))
}
