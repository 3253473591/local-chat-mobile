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
}

export function normalizeUsage(u: Record<string, unknown> | undefined): ApiUsage | undefined {
  if (!u) return undefined
  const prompt = Number(u.prompt_tokens ?? 0)
  const completion = Number(u.completion_tokens ?? 0)
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: Number(u.total_tokens ?? prompt + completion),
    promptCacheHitTokens: u.prompt_cache_hit_tokens as number | undefined,
    promptCacheMissTokens: u.prompt_cache_miss_tokens as number | undefined,
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
}

export interface StreamOptions {
  model: string
  messages: ApiMessage[]
  apiKey: string
  signal?: AbortSignal
  /** false = 关闭思考模式（thinking disabled）；默认开启 */
  thinking?: boolean
  /** 思考深度：low / high / max（仅思考模式生效） */
  reasoningEffort?: string
  /** 温度（思考模式下无效，API 忽略不报错） */
  temperature?: number
}

/** 解析一条 SSE 行，返回 data payload；非 data 行为 null */
export function parseSseLine(line: string): string | null {
  const t = line.trim()
  if (!t.startsWith('data:')) return null
  return t.slice(5).trim()
}

/** 流式对话：逐 chunk 回调增量，返回完整内容与 usage */
export async function streamChat(opts: StreamOptions, onDelta: (d: ChatDelta) => void): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
  }
  if (opts.thinking === false) {
    body.thinking = { type: 'disabled' }
    if (opts.temperature != null) body.temperature = opts.temperature
  } else {
    if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort
  }

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
        const delta = j.choices?.[0]?.delta
        const dc = delta?.content as string | undefined
        const dr = delta?.reasoning_content as string | undefined
        if (dc) content += dc
        if (dr) reasoning += dr
        if (j.usage) usage = normalizeUsage(j.usage)
        if (dc || dr) onDelta({ content: dc ?? '', reasoning: dr ?? '' })
      } catch {
        // 半行/异常 payload，忽略
      }
    }
  }

  return { content, reasoning, usage }
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
  totalBalance: number
  grantedBalance: number
  toppedUpBalance: number
}

/** 查询账户余额（单位待实测：元/分） */
export async function getBalance(apiKey: string): Promise<BalanceInfo[]> {
  const res = await fetch(`${BASE}/user/balance`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  const j = (await res.json()) as {
    balance_infos?: { currency?: string; total_balance?: number; granted_balance?: number; topped_up_balance?: number }[]
  }
  return (j.balance_infos ?? []).map((b) => ({
    currency: b.currency ?? '',
    totalBalance: b.total_balance ?? 0,
    grantedBalance: b.granted_balance ?? 0,
    toppedUpBalance: b.topped_up_balance ?? 0,
  }))
}
