/**
 * 生成唯一 ID。
 * crypto.randomUUID 仅在 secure context（HTTPS / localhost）可用；
 * 手机通过局域网 HTTP 访问时需降级到时间戳+随机数方案。
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
