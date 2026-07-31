import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false })

/** Markdown → 纯文本（去除标记） */
export function markdownToPlainText(source: string): string {
  const html = md.render(source)
  if (typeof document === 'undefined') return source
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent ?? '').trim()
}
