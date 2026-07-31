export interface MessageUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
}

export interface MessageNode {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  parentId: string | null // null = 根（root）的子节点
  content: string // assistant 为正则处理后内容
  rawContent?: string // assistant 原始输出（正则前）
  reasoning?: string // 思维链（reasoner 专属）
  model?: string // 生成该消息的模型
  usage?: MessageUsage
  versionIndex: number // 同父兄弟实时序号，从 1 开始
  createdAt: number
  updatedAt: number
}

export interface Conversation {
  id: string
  title: string
  model: string
  prompt: string
  regex: string
  regexReplacement: string
  xRounds: number
  bgImage?: string
  avatar?: string // 对话级 AI 头像（覆盖全局）
  userAvatar?: string // 对话级用户头像（覆盖全局）
  thinkingEnabled?: boolean // 对话级思考模式（undefined = 跟随全局）
  reasoningEffort?: string // 对话级思考深度（undefined = 跟随全局）
  temperature?: number // 对话级温度（undefined = 跟随全局）
  pinnedAt?: number // 置顶时间（置顶对话固定排在前面）
  activePath: string[] // 当前显示路径（节点 id 序列）
  createdAt: number
  updatedAt: number
}

export interface ModelPrice {
  in: number // 元/百万输入 token（未命中缓存）
  out: number // 元/百万输出 token
  cacheHit: number // 元/百万输入 token（缓存命中）
}

/** 分时段计费（DeepSeek 高峰时段价格翻倍） */
export interface PeakRule {
  enabled: boolean
  multiplier: number
  peaks: { start: string; end: string }[] // HH:mm，本地时间
}

export interface GlobalSettings {
  apiKey: string
  defaultModel: string
  models: string[] // 动态拉取
  costTracking: boolean
  prompt: string
  regex: string
  regexReplacement: string
  xRounds: number
  bgImage: string
  avatar: string // AI 头像
  userAvatar: string // 用户头像
  thinkingEnabled: boolean // 思考模式（思维链），默认 true
  reasoningEffort: string // 思考深度：low / high / max（全局）
  temperature: number | null // 温度（全局，null = 用 API 默认；思考模式下无效）
  peakRule: PeakRule // 分时段计费规则
  prices: Record<string, ModelPrice>
}

/** 流式增量类型 */
export type StreamDelta = {
  content: string
  reasoning?: string
}
