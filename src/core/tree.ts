import type { MessageNode } from '../types'
import { genId } from '../utils/id'

/**
 * 对话树引擎 —— 纯函数，不触碰存储。
 * 输入节点 Map 与操作参数，返回新 Map / 路径 / 候选等。
 * 分支模型语义见 设计文档.md §4/§5.1。
 */

export type NodeMap = Record<string, MessageNode>

/** 某父节点下的直接子节点（按 versionIndex 排序） */
export function childrenOf(nodes: NodeMap, parentId: string | null): MessageNode[] {
  return Object.values(nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.versionIndex - b.versionIndex)
}

/** 同父兄弟实时序号（下一个版本号） */
export function nextVersionIndex(nodes: NodeMap, parentId: string | null): number {
  return childrenOf(nodes, parentId).length + 1
}

/** 某节点是否存在子节点 */
export function hasChildren(nodes: NodeMap, nodeId: string): boolean {
  return Object.values(nodes).some((n) => n.parentId === nodeId)
}

interface CreateInput {
  conversationId: string
  parentId: string | null
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  model?: string
  id?: string // 测试注入固定 id
}

export function createNode(nodes: NodeMap, input: CreateInput): MessageNode {
  // 不变量：父子角色必须交替；根（null）的子节点恒为 user
  if (input.parentId === null && input.role !== 'user') {
    throw new Error('root children must be user role')
  }
  if (input.parentId !== null) {
    const parent = nodes[input.parentId]
    if (parent && parent.role === input.role) {
      throw new Error('parent-child role must alternate')
    }
  }
  const now = Date.now()
  const node: MessageNode = {
    id: input.id ?? genId(),
    conversationId: input.conversationId,
    role: input.role,
    parentId: input.parentId,
    content: input.content,
    versionIndex: nextVersionIndex(nodes, input.parentId),
    createdAt: now,
    updatedAt: now,
  }
  if (input.reasoning !== undefined) node.reasoning = input.reasoning
  if (input.model !== undefined) node.model = input.model
  return node
}

/** 节点加入 Map（返回新 Map） */
export function appendTo(nodes: NodeMap, node: MessageNode): NodeMap {
  return { ...nodes, [node.id]: node }
}

/** 编辑 user → 同父新建 user 节点（版本+1），返回新 Map 与新节点 id */
export function editUserNode(
  nodes: NodeMap,
  targetId: string,
  newContent: string
): { nodes: NodeMap; newNodeId: string } {
  const target = nodes[targetId]
  if (!target) throw new Error('node not found')
  if (target.role !== 'user') throw new Error('editUserNode: target must be user')
  const newNode = createNode(nodes, {
    conversationId: target.conversationId,
    parentId: target.parentId,
    role: 'user',
    content: newContent,
  })
  return { nodes: appendTo(nodes, newNode), newNodeId: newNode.id }
}

/** 刷新 AI → 父 user 下新建 assistant 节点（版本+1） */
export function refreshAssistant(
  nodes: NodeMap,
  parentUserId: string
): { nodes: NodeMap; newNodeId: string } {
  const parent = nodes[parentUserId]
  if (!parent) throw new Error('parent user not found')
  if (parent.role !== 'user') throw new Error('refreshAssistant: parent must be user')
  const newNode = createNode(nodes, {
    conversationId: parent.conversationId,
    parentId: parentUserId,
    role: 'assistant',
    content: '',
  })
  return { nodes: appendTo(nodes, newNode), newNodeId: newNode.id }
}

/** 就地覆盖 assistant 节点内容（修改回复），返回新 Map */
export function editAssistantNode(
  nodes: NodeMap,
  nodeId: string,
  content: string,
  reasoning?: string
): NodeMap {
  const n = nodes[nodeId]
  if (!n) throw new Error('node not found')
  if (n.role !== 'assistant') throw new Error('editAssistantNode: target must be assistant')
  const updated: MessageNode = { ...n, content, updatedAt: Date.now() }
  if (reasoning !== undefined) updated.reasoning = reasoning
  return { ...nodes, [nodeId]: updated }
}

/** 收集某节点全部后代 id（含自身） */
export function collectSubtreeIds(nodes: NodeMap, rootId: string): string[] {
  const result: string[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    result.push(id)
    for (const n of Object.values(nodes)) {
      if (n.parentId === id) stack.push(n.id)
    }
  }
  return result
}

/** 级联删除子树，返回新 Map */
export function deleteSubtree(nodes: NodeMap, rootId: string): NodeMap {
  const removed = new Set(collectSubtreeIds(nodes, rootId))
  const next: NodeMap = {}
  for (const [id, n] of Object.entries(nodes)) {
    if (!removed.has(id)) next[id] = n
  }
  return next
}

/**
 * 删除一个"对话轮次"（user + 其所有 assistant 子节点），后续节点向上接续。
 * - user 节点自身被删除
 * - user 的所有 assistant 子节点（含多个版本）被删除
 * - 每个 assistant 子节点的子节点（user）的 parentId 改为 user 的 parentId
 *
 * 例：U1→A1→U2→A2→U3→A3，删除 U1：
 *   U1、A1 被删，U2.parentId = null → 对话变成 U2→A2→U3→A3
 */
export function deleteRound(nodes: NodeMap, userId: string): NodeMap {
  const user = nodes[userId]
  if (!user) throw new Error('node not found')
  const next = { ...nodes }

  // 收集所有 assistant 子节点（含版本）
  const assistants = childrenOf(nodes, userId).filter((n) => n.role === 'assistant')

  // 所有 assistant 的子节点 → 重新挂到 user 的父节点
  for (const a of assistants) {
    for (const gc of childrenOf(nodes, a.id)) {
      const rehomed: MessageNode = { ...gc, parentId: user.parentId, updatedAt: Date.now() }
      next[gc.id] = rehomed
    }
  }

  // 删除 user + 所有 assistant 子节点
  delete next[userId]
  for (const a of assistants) {
    delete next[a.id]
  }

  return next
}

/** 从节点向上到根，返回 根→节点 路径 */
export function pathToNode(nodes: NodeMap, nodeId: string): string[] {
  const path: string[] = []
  let cur: string | undefined = nodeId
  while (cur && nodes[cur]) {
    path.unshift(cur)
    cur = nodes[cur].parentId ?? undefined
  }
  return path
}

/** 无有效 activePath 时：沿"最近分支"（versionIndex 最大的子节点）走到叶子 */
export function resolveInitialPath(nodes: NodeMap): string[] {
  const path: string[] = []
  const roots = childrenOf(nodes, null)
  if (roots.length === 0) return path
  let current = roots[roots.length - 1].id
  path.push(current)
  for (;;) {
    const kids = childrenOf(nodes, current)
    if (kids.length === 0) break
    current = kids[kids.length - 1].id
    path.push(current)
  }
  return path
}

/** 校验 path 是否为连贯的父→子链 */
export function isValidPath(nodes: NodeMap, path: string[]): boolean {
  for (let i = 0; i < path.length; i++) {
    const n = nodes[path[i]]
    if (!n) return false
    if (i > 0 && n.parentId !== path[i - 1]) return false
  }
  return true
}

export interface PathView {
  path: string[]
  tailId: string
  candidates: MessageNode[]
}

/**
 * 从节点出发，逐级取 versionIndex 最大的子节点，递归走到叶子。
 */
export function followLatestBranch(nodes: NodeMap, fromId: string): string[] {
  const result: string[] = []
  let cur = fromId
  for (;;) {
    const kids = childrenOf(nodes, cur)
    if (kids.length === 0) break
    cur = kids[kids.length - 1].id
    result.push(cur)
  }
  return result
}

/**
 * 切换版本：在 path 中定位与 target 同父的兄弟节点，替换为 target，
 * 然后自动跟随最新子节点走到叶子（不再"停在节点、手动再选"）。
 */
export function switchVersion(nodes: NodeMap, path: string[], targetVersionId: string): PathView {
  const target = nodes[targetVersionId]
  if (!target) throw new Error('target node not found')
  const idx = path.findIndex((id) => nodes[id]?.parentId === target.parentId)
  if (idx === -1) throw new Error('no sibling of target in current path')
  // 截断 + 替换 + 自动沿最新分支走到叶子
  const newPath = [...path.slice(0, idx), targetVersionId, ...followLatestBranch(nodes, targetVersionId)]
  const tailId = newPath[newPath.length - 1]
  return { path: newPath, tailId, candidates: childrenOf(nodes, tailId) }
}

/** 沿候选继续：path 追加候选节点（候选必须是当前尾部的直接子节点） */
export function extendPath(nodes: NodeMap, path: string[], candidateId: string): PathView {
  const cand = nodes[candidateId]
  if (!cand) throw new Error('candidate not found')
  const tail = nodes[path[path.length - 1]]
  if (!tail || cand.parentId !== tail.id) throw new Error('candidate must be child of tail')
  const newPath = [...path, candidateId]
  return { path: newPath, tailId: candidateId, candidates: childrenOf(nodes, candidateId) }
}

/**
 * 发送用户消息（普通输入）。
 * - 尾部是 assistant → 追加 user 子节点，返回待回复的 user 节点 id
 * - 尾部是 user（等待 AI）→ 不创建新节点，返回该 user 节点 id（触发其 AI 回复，新文本丢弃）
 */
export function sendUserMessage(
  nodes: NodeMap,
  path: string[],
  content: string,
  conversationId: string
): { nodes: NodeMap; path: string[]; tailId: string; pendingUserId: string } {
  const tailId = path[path.length - 1]
  const tail = nodes[tailId]

  // 无任何节点（首次发送）：创建根下 user 节点
  if (!tail) {
    const node = createNode(nodes, { conversationId, parentId: null, role: 'user', content })
    return { nodes: appendTo(nodes, node), path: [node.id], tailId: node.id, pendingUserId: node.id }
  }

  if (tail.role === 'assistant') {
    const node = createNode(nodes, {
      conversationId: tail.conversationId || conversationId,
      parentId: tail.id,
      role: 'user',
      content,
    })
    const newPath = [...path, node.id]
    return { nodes: appendTo(nodes, node), path: newPath, tailId: node.id, pendingUserId: node.id }
  }

  // 尾部已是 user：忽略新文本，为其触发 AI 回复
  return { nodes, path, tailId, pendingUserId: tailId }
}

/**
 * 为"待回复"的 user 节点生成 assistant 子节点（触发 AI 后的落库）。
 * 若该 user 已有 assistant 子节点，则视为刷新（新增版本）。
 */
export function replyToUser(
  nodes: NodeMap,
  path: string[],
  parentUserId: string
): { nodes: NodeMap; path: string[]; tailId: string; assistantId: string } {
  const parent = nodes[parentUserId]
  if (!parent || parent.role !== 'user') throw new Error('parent must be user')
  const node = createNode(nodes, {
    conversationId: parent.conversationId,
    parentId: parentUserId,
    role: 'assistant',
    content: '',
  })
  const idx = path.indexOf(parentUserId)
  const newPath = idx === -1 ? [...path, node.id] : [...path.slice(0, idx + 1), node.id]
  return { nodes: appendTo(nodes, node), path: newPath, tailId: node.id, assistantId: node.id }
}
