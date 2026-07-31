import { defineStore } from 'pinia'
import { ref } from 'vue'
import { streamChat } from '../api/deepseek'
import { buildMessages, applyRegex } from '../core/context'
import { computeCost } from '../core/cost'
import {
  childrenOf,
  collectSubtreeIds,
  deleteSubtree as treeDeleteSubtree,
  editAssistantNode,
  editUserNode as treeEditUserNode,
  extendPath as treeExtendPath,
  isValidPath,
  pathToNode,
  refreshAssistant,
  replyToUser as treeReplyToUser,
  resolveInitialPath,
  sendUserMessage as treeSendUserMessage,
  switchVersion as treeSwitchVersion,
  type NodeMap,
} from '../core/tree'
import * as repo from '../db/repository'
import type { Conversation, MessageNode } from '../types'
import { genId } from '../utils/id'
import { normalizeModel } from '../utils/model'
import { useSettingsStore } from './settings'

const ZERO_PRICE = { in: 0, out: 0, cacheHit: 0 }

export const useConversationStore = defineStore('conversation', () => {
  const settingsStore = useSettingsStore()

  const conversations = ref<Conversation[]>([])
  const currentId = ref<string | null>(null)
  /** 当前对话的节点 Map（进入对话时加载） */
  const nodes = ref<NodeMap>({})
  /** 当前显示路径（根→尾） */
  const activePath = ref<string[]>([])
  /** 尾部节点的直接子节点（候选行） */
  const candidates = ref<MessageNode[]>([])
  const isStreaming = ref(false)
  const streamingNodeId = ref<string | null>(null)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  function getCurrentConv(): Conversation | null {
    if (!currentId.value) return null
    return conversations.value.find((c) => c.id === currentId.value) ?? null
  }

  /** 持久化对话元数据（updatedAt + activePath） */
  async function persistMeta() {
    const conv = getCurrentConv()
    if (!conv) return
    conv.updatedAt = Date.now()
    conv.activePath = [...activePath.value]
    await repo.saveConversation(conv)
  }

  function sortConversations(list: Conversation[]): Conversation[] {
    return [...list].sort((a, b) => {
      const ap = a.pinnedAt ? 1 : 0
      const bp = b.pinnedAt ? 1 : 0
      if (ap !== bp) return bp - ap // 置顶在前
      return b.updatedAt - a.updatedAt
    })
  }

  async function loadConversations() {
    conversations.value = sortConversations(await repo.loadConversations())
  }

  async function enterConversation(id: string) {
    currentId.value = id
    let conv = conversations.value.find((c) => c.id === id)
    if (!conv) {
      conv = await repo.getConversation(id)
      if (conv) conversations.value.unshift(conv)
    }
    const msgs = await repo.loadMessages(id)
    const map: NodeMap = {}
    for (const m of msgs) map[m.id] = m
    nodes.value = map
    let path = conv?.activePath ?? []
    if (!isValidPath(map, path)) path = resolveInitialPath(map)
    activePath.value = path
    candidates.value = path.length ? childrenOf(map, path[path.length - 1]) : []
    isStreaming.value = false
    streamingNodeId.value = null
    error.value = null
  }

  async function createConversation(config: Partial<Conversation> = {}): Promise<string> {
    const s = settingsStore.settings
    const conv: Conversation = {
      id: genId(),
      title: '新对话',
      model: s.defaultModel,
      prompt: s.prompt,
      regex: s.regex,
      regexReplacement: s.regexReplacement,
      xRounds: s.xRounds,
      bgImage: undefined,
      avatar: undefined,
      activePath: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...config,
    }
    await repo.saveConversation(conv)
    await loadConversations()
    return conv.id
  }

  async function deleteConversation(id: string) {
    await repo.deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (currentId.value === id) {
      currentId.value = null
      nodes.value = {}
      activePath.value = []
      candidates.value = []
    }
  }

  /** 为某 user 节点生成 assistant 子节点并流式回复 */
  async function replyToUserNode(parentUserId: string) {
    const rep = treeReplyToUser(nodes.value, activePath.value, parentUserId)
    nodes.value = rep.nodes
    activePath.value = rep.path
    candidates.value = []
    await repo.upsertNodes([nodes.value[rep.assistantId]])
    await persistMeta()
    await runStream(rep.assistantId, activePath.value)
  }

  /** 发送用户消息（含触发 AI 回复） */
  async function sendUserMessage(content: string) {
    if (!currentId.value || isStreaming.value) return
    // 1. 确定待回复的 user 节点（尾部 assistant → 新建；尾部 user → 复用）
    const s = treeSendUserMessage(nodes.value, activePath.value, content, currentId.value)
    nodes.value = s.nodes
    activePath.value = s.path
    candidates.value = childrenOf(nodes.value, s.tailId)
    await repo.upsertNodes([nodes.value[s.pendingUserId]])

    // 2. 生成 assistant 节点并流式回复
    await replyToUserNode(s.pendingUserId)
  }

  /** 编辑 user → 同父新建 user 节点，并立即触发 AI 回复 */
  async function editUserMessage(nodeId: string, newContent: string) {
    if (isStreaming.value) return
    const edit = treeEditUserNode(nodes.value, nodeId, newContent)
    nodes.value = edit.nodes
    activePath.value = pathToNode(nodes.value, edit.newNodeId)
    candidates.value = childrenOf(nodes.value, edit.newNodeId)
    await repo.upsertNodes([nodes.value[edit.newNodeId]])
    await persistMeta()
    await replyToUserNode(edit.newNodeId)
  }

  /** 刷新 AI → 同父新建 assistant 节点并重新生成 */
  async function refreshAIReply(parentUserId: string) {
    if (!currentId.value || isStreaming.value) return
    const rep = refreshAssistant(nodes.value, parentUserId)
    nodes.value = rep.nodes
    const path = pathToNode(nodes.value, rep.newNodeId)
    activePath.value = path
    candidates.value = []
    await repo.upsertNodes([nodes.value[rep.newNodeId]])
    await persistMeta()
    await runStream(rep.newNodeId, path)
  }

  /** 修改 AI 回复 → 就地覆盖（含思维链）+ 重跑正则 */
  async function editAIReply(nodeId: string, content: string, reasoning?: string) {
    const conv = getCurrentConv()
    const s = settingsStore.settings
    const processed = applyRegex(
      content,
      conv?.regex || s.regex,
      conv?.regexReplacement ?? s.regexReplacement,
    )
    nodes.value = editAssistantNode(nodes.value, nodeId, processed, reasoning)
    nodes.value[nodeId] = { ...nodes.value[nodeId], rawContent: content }
    await repo.upsertNodes([nodes.value[nodeId]])
  }

  /** 切换版本 → 重算路径，尾部子节点成为候选 */
  function switchVersion(nodeId: string) {
    const view = treeSwitchVersion(nodes.value, activePath.value, nodeId)
    activePath.value = view.path
    candidates.value = view.candidates
    void persistMeta()
  }

  /** 沿候选继续 → 路径延伸 */
  function extendPath(candidateId: string) {
    const view = treeExtendPath(nodes.value, activePath.value, candidateId)
    activePath.value = view.path
    candidates.value = view.candidates
    void persistMeta()
  }

  /** 级联删除子树 */
  async function deleteSubtree(nodeId: string) {
    const removed = collectSubtreeIds(nodes.value, nodeId)
    nodes.value = treeDeleteSubtree(nodes.value, nodeId)
    const removedSet = new Set(removed)
    activePath.value = activePath.value.filter((id) => !removedSet.has(id))
    candidates.value = []
    await repo.deleteMessages(removed)
    await persistMeta()
  }

  /** 切换当前对话的模型（后续请求生效，历史消息费用仍按原模型单价） */
  async function setModel(model: string) {
    const conv = getCurrentConv()
    if (!conv || conv.model === model) return
    conv.model = model
    await repo.saveConversation(conv)
  }

  /** 重命名对话 */
  async function renameConversation(id: string, title: string) {
    const conv = conversations.value.find((c) => c.id === id)
    if (!conv || !title.trim()) return
    conv.title = title.trim()
    await repo.saveConversation(conv)
  }

  /** 置顶 / 取消置顶 */
  async function togglePin(id: string) {
    const conv = conversations.value.find((c) => c.id === id)
    if (!conv) return
    if (conv.pinnedAt) {
      delete conv.pinnedAt
    } else {
      conv.pinnedAt = Date.now()
    }
    conversations.value = sortConversations(conversations.value)
    await repo.saveConversation(conv)
  }

  /** 对话级 AI 增强设置（模型/提示词/正则/X 轮/思考模式/深度/温度） */
  async function setEnhance(
    config: Partial<
      Pick<
        Conversation,
        'model' | 'prompt' | 'regex' | 'regexReplacement' | 'xRounds' | 'thinkingEnabled' | 'reasoningEffort' | 'temperature'
      >
    >,
  ) {
    const conv = getCurrentConv()
    if (!conv) return
    Object.assign(conv, config)
    await repo.saveConversation(conv)
  }

  /** 对话级外观（背景/AI 头像/用户头像，空 = 用全局） */
  async function setAppearance(
    config: Partial<Pick<Conversation, 'bgImage' | 'avatar' | 'userAvatar'>>,
  ) {
    const conv = getCurrentConv()
    if (!conv) return
    Object.assign(conv, config)
    await repo.saveConversation(conv)
  }

  /** 暂停流式（保留已收部分内容） */
  function pauseStream() {
    abortController?.abort()
  }

  /** 流式生成一条 assistant 回复（sendUserMessage / refreshAIReply 共用） */
  async function runStream(assistantId: string, path: string[]) {
    const conv = getCurrentConv()
    if (!conv || !currentId.value || isStreaming.value) return
    const s = settingsStore.settings
    const model = normalizeModel(conv.model || s.defaultModel)
    const thinkingEnabled = conv.thinkingEnabled ?? s.thinkingEnabled
    const reasoningEffort = conv.reasoningEffort ?? s.reasoningEffort
    const temperature = conv.temperature ?? s.temperature
    const asst = nodes.value[assistantId]
    const parentUser = asst?.parentId ? nodes.value[asst.parentId] : undefined

    const messages = buildMessages(nodes.value, path, {
      xRounds: conv.xRounds || s.xRounds,
      prompt: conv.prompt || s.prompt,
      currentUserContent: parentUser?.content ?? '',
    })

    isStreaming.value = true
    streamingNodeId.value = assistantId
    abortController = new AbortController()

    try {
      const result = await streamChat(
        {
          model,
          messages,
          apiKey: s.apiKey,
          signal: abortController.signal,
          thinking: thinkingEnabled,
          reasoningEffort,
          temperature: temperature ?? undefined,
        },
        (d) => {
          const cur = nodes.value[assistantId]
          if (!cur) return
          nodes.value[assistantId] = {
            ...cur,
            content: cur.content + d.content,
            reasoning: (cur.reasoning ?? '') + d.reasoning,
            updatedAt: Date.now(),
          }
        },
      )
      // 流式结束：正则 + usage + 落库
      const cur = nodes.value[assistantId]
      if (!cur) return
      const raw = cur.content
      const finalNode: MessageNode = {
        ...cur,
        content: applyRegex(raw, conv.regex || s.regex, conv.regexReplacement ?? s.regexReplacement),
        rawContent: raw,
        model,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
              promptCacheHitTokens: result.usage.promptCacheHitTokens,
              promptCacheMissTokens: result.usage.promptCacheMissTokens,
              cost: computeCost(result.usage, s.prices[model] ?? ZERO_PRICE, s.peakRule, new Date(cur.createdAt)),
            }
          : undefined,
        updatedAt: Date.now(),
      }
      nodes.value[assistantId] = finalNode
      await repo.upsertNodes([finalNode])
      await persistMeta()
    } catch (e) {
      // 暂停（AbortError）或失败：保留已收部分内容
      const cur = nodes.value[assistantId]
      if (cur) {
        cur.updatedAt = Date.now()
        await repo.upsertNodes([cur])
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        error.value = null // 主动暂停不算错误
      } else {
        error.value = e instanceof Error ? e.message : String(e)
      }
    } finally {
      isStreaming.value = false
      streamingNodeId.value = null
      abortController = null
    }
  }

  return {
    conversations,
    currentId,
    nodes,
    activePath,
    candidates,
    isStreaming,
    streamingNodeId,
    error,
    loadConversations,
    enterConversation,
    createConversation,
    deleteConversation,
    sendUserMessage,
    editUserMessage,
    refreshAIReply,
    editAIReply,
    switchVersion,
    extendPath,
    deleteSubtree,
    setModel,
    renameConversation,
    togglePin,
    setEnhance,
    setAppearance,
    pauseStream,
  }
})
