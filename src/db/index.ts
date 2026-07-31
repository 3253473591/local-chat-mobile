import Dexie, { type EntityTable } from 'dexie'
import type { Conversation, GlobalSettings, MessageNode } from '../types'

export interface SettingsRow extends GlobalSettings {
  key: string
}

const db = new Dexie('local-chat') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>
  messages: EntityTable<MessageNode, 'id'>
  settings: EntityTable<SettingsRow, 'key'>
}

db.version(1).stores({
  conversations: 'id, updatedAt',
  messages: 'id, conversationId',
  settings: 'key',
})

export { db }
