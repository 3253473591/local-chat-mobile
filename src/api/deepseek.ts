import type { ApiMessage } from '../core/context'

/**
 * DeepSeek API 集成层 —— 纯前端直连（实测确认 CORS 放行）。
 * 流式请求带 stream_options.include_usage，末尾 chunk 返回 usage（实测确认）。
 */

const BASE = 'https://api.deepseek.com'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`DeepSeek API ${status}: ${body.slice(0, 120)}`)
  }
}

export interface ApiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
  /** 思维链 token 数（completion_tokens_details.reasoning_tokens） */
  reasoningTokens?: number
}

export function normalizeUsage(u: Record<string, unknown> | undefined): ApiUsage | undefined {
  if (!u) return undefined
  const prompt = Number(u.prompt_tokens ?? 0)
  const completion = Number(u.completion_tokens ?? 0)
  const details = u.completion_tokens_details as { reasoning_tokens?: number } | undefined
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: Number(u.total_tokens ?? prompt + completion),
    promptCacheHitTokens: u.prompt_cache_hit_tokens as number | undefined,
    promptCacheMissTokens: u.prompt_cache_miss_tokens as number | undefined,
    reasoningTokens: details?.reasoning_tokens as number | undefined,
  }
}

export interface ChatDelta {
  content: string
  reasoning: string
}

export interface ChatResult {
  content: string
  reasoning: string
  usage?: ApiUsage
  /** 停止原因：stop / length / content_filter / tool_calls / insufficient_system_resource */
  finishReason?: string
}

export interface StreamOptions {
  model: string
  messages: ApiMessage[]
  apiKey: string
  signal?: AbortSignal
  /** false = 关闭思考模式（thinking disabled）；默认开启 */
  thinking?: boolean
  /** 思考深度：low / high / xhigh / max（仅思考模式生效） */
  reasoningEffort?: string
  /** 温度 0~2（仅非思考模式生效；思考模式不支持，传了会被忽略） */
  temperature?: number
  /** top_p 0~1（仅非思考模式生效；思考模式不支持，传了会被忽略） */
  topP?: number
}

/**
 * 构造 /chat/completions 请求体（纯函数，可测试）。
 * 依据官方文档：思考模式不支持 temperature / top_p / presence_penalty / frequency_penalty，
 * 故思考模式下**不发送** temperature 与 top_p；非思考模式下才发送。
 */
export function buildChatBody(opts: {
  model: string
  messages: ApiMessage[]
  thinking: boolean
  reasoningEffort?: string
  temperature?: number
  topP?: number
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
  }
  if (opts.thinking) {
    body.thinking = { type: 'enabled' }
    if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort
    // 思考模式：temperature / top_p 官方不支持，不发送
  } else {
    body.thinking = { type: 'disabled' }
    if (opts.temperature != null) body.temperature = opts.temperature
    if (opts.topP != null) body.top_p = opts.topP
  }
  return body
}

/** 解析一条 SSE 行，返回 data payload；非 data 行为 null */
export function parseSseLine(line: string): string | null {
  const t = line.trim()
  if (!t.startsWith('data:')) return null
  return t.slice(5).trim()
}

/** 流式对话：逐 chunk 回调增量，返回完整内容与 usage */
export async function streamChat(opts: StreamOptions, onDelta: (d: ChatDelta) => void): Promise<ChatResult> {
  const body = buildChatBody({
    model: opts.model,
    messages: opts.messages,
    thinking: opts.thinking !== false,
    reasoningEffort: opts.reasoningEffort,
    temperature: opts.temperature,
    topP: opts.topP,
  })

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    throw new ApiError(res.status, await res.text().catch(() => ''))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  let reasoning = ''
  let usage: ApiUsage | undefined
  let finishReason: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const payload = parseSseLine(line)
      if (!payload || payload === '[DONE]') continue
      try {
        const j = JSON.parse(payload)
        const choice = j.choices?.[0]
        const delta = choice?.delta
        const dc = delta?.content as string | undefined
        const dr = delta?.reasoning_content as string | undefined
        if (dc) content += dc
        if (dr) reasoning += dr
        if (j.usage) usage = normalizeUsage(j.usage)
        // 末尾 chunk 携带 finish_reason（如 insufficient_system_resource 截断）
        if (choice?.finish_reason) finishReason = choice.finish_reason
        if (dc || dr) onDelta({ content: dc ?? '', reasoning: dr ?? '' })
      } catch {
        // 半行/异常 payload，忽略
      }
    }
  }

  return { content, reasoning, usage, finishReason }
}

/** 动态拉取模型列表 */
export async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  const j = (await res.json()) as { data?: { id: string }[] }
  return j.data?.map((m) => m.id) ?? []
}

export interface BalanceInfo {
  currency: string
  /** 余额字段官方返回字符串（如 "110.00"），保持字符串透传给 UI 展示 */
  totalBalance: string
  grantedBalance: string
  toppedUpBalance: string
}

/** 查询账户余额 */
export async function getBalance(apiKey: string): Promise<BalanceInfo[]> {
  const res = await fetch(`${BASE}/user/balance`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  const j = (await res.json()) as {
    balance_infos?: { currency?: string; total_balance?: string; granted_balance?: string; topped_up_balance?: string }[]
  }
  return (j.balance_infos ?? []).map((b) => ({
    currency: b.currency ?? '',
    totalBalance: b.total_balance ?? '',
    grantedBalance: b.granted_balance ?? '',
    toppedUpBalance: b.topped_up_balance ?? '',
  }))
}
