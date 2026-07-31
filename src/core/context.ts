import type { MessageNode } from '../types'
import type { NodeMap } from './tree'

/**
 * 上下文组装 —— 沿当前路径取最近 X 对 (User+Assistant) 历史 + 当前输入 + 系统提示词。
 * X 只沿当前路径计数，不跨分支；assistant 只传 content（思维链不进上下文）。
 */

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 沿 path 从尾部向上收集最近 X 对 (user+assistant) 历史，保持对话顺序。
 * 尾部若为"待回复的 user"，其本身不参与配对（由调用方作为当前输入单独追加）。
 */
export function collectPairs(nodes: NodeMap, path: string[], xRounds: number): MessageNode[] {
  const result: MessageNode[] = []
  const pathNodes = path.map((id) => nodes[id]).filter((n): n is MessageNode => Boolean(n))
  let i = pathNodes.length - 1
  let pairs = 0
  while (i >= 0 && pairs < xRounds) {
    const node = pathNodes[i]
    if (node.role === 'assistant') {
      // 空内容 = 进行中/未完成回复，不算历史
      if (!node.content) {
        i--
        continue
      }
      if (node.parentId && nodes[node.parentId]) {
        result.unshift(nodes[node.parentId]!, node)
        i -= 2
        pairs++
        continue
      }
    }
    i--
  }
  return result
}

export interface BuildOptions {
  xRounds: number
  prompt: string
  /** 当前待发送/待回复的用户消息 */
  currentUserContent: string
}

export function buildMessages(nodes: NodeMap, path: string[], opts: BuildOptions): ApiMessage[] {
  const messages: ApiMessage[] = []
  if (opts.prompt) messages.push({ role: 'system', content: opts.prompt })
  for (const n of collectPairs(nodes, path, opts.xRounds)) {
    messages.push({ role: n.role, content: n.content })
  }
  if (opts.currentUserContent) {
    messages.push({ role: 'user', content: opts.currentUserContent })
  }
  return messages
}

/**
 * 正则处理（仅处理 AI 返回结果）。
 * pattern 支持 `/pattern/flags` 形式或纯 pattern（默认全局）。
 * 幂等性由用户保证（replacement 型的正则二次应用通常无副作用）。
 */
export function applyRegex(text: string, pattern: string, replacement = ''): string {
  if (!pattern) return text
  try {
    const m = pattern.match(/^\/(.+)\/([a-z]*)$/)
    const re = m ? new RegExp(m[1], m[2]) : new RegExp(pattern, 'g')
    return text.replace(re, replacement)
  } catch {
    return text // 非法正则：原样返回
  }
}
