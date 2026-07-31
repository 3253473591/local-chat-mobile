/**
 * 模型名迁移：deepseek-chat / deepseek-reasoner 已于 2026-07-24 弃用，
 * 分别对应 deepseek-v4-flash 的非思考/思考模式。旧对话存的模型名需路由到新模型。
 */
const LEGACY_MAP: Record<string, string> = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
}

export function normalizeModel(model: string): string {
  return LEGACY_MAP[model] ?? model
}
