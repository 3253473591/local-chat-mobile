<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github.css'
import { copyText } from '../utils/clipboard'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    const escaped = escapeHtml(str)
    let code = escaped
    if (lang && hljs.getLanguage(lang)) {
      try {
        code = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch {
        code = escaped
      }
    }
    return `<div class="code-block"><button class="code-copy" type="button">复制</button><pre class="hljs"><code>${code}</code></pre></div>`
  },
})

const props = defineProps<{ source: string }>()
const html = computed(() => md.render(props.source))

function onBodyClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.code-copy')
  if (!btn) return
  const codeEl = btn.parentElement?.querySelector('code')
  if (!codeEl) return
  void copyText(codeEl.textContent ?? '')
  const origin = btn.textContent
  btn.textContent = '已复制'
  setTimeout(() => {
    btn.textContent = origin
  }, 1200)
}
</script>

<template>
  <div class="markdown-body" @click="onBodyClick" v-html="html"></div>
</template>

<style>
/* v-html 内容不受 scoped 限制，这里用全局样式 */
.markdown-body {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.markdown-body > *:first-child {
  margin-top: 0;
}
.markdown-body > *:last-child {
  margin-bottom: 0;
}
.markdown-body p {
  margin: 0.4em 0;
}
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  font-weight: 600;
  margin: 0.6em 0 0.3em;
  font-size: 1.1em;
}
.markdown-body ul,
.markdown-body ol {
  margin: 0.4em 0;
  padding-left: 1.4em;
}
.markdown-body a {
  color: #576b95;
}
.markdown-body table {
  border-collapse: collapse;
  margin: 0.5em 0;
}
.markdown-body th,
.markdown-body td {
  border: 1px solid #ddd;
  padding: 4px 8px;
}
.markdown-body blockquote {
  margin: 0.4em 0;
  padding-left: 0.8em;
  border-left: 3px solid #ddd;
  color: #888;
}
.markdown-body :not(pre) > code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1em 0.3em;
  border-radius: 4px;
  font-size: 0.92em;
}
.code-block {
  position: relative;
  margin: 0.5em 0;
}
.code-block .hljs {
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
}
.code-copy {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border: 1px solid #ddd;
  cursor: pointer;
}
</style>
