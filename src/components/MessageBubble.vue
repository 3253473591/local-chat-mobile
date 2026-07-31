<script setup lang="ts">
import { computed, ref } from 'vue'
import { computeCost, formatCost } from '../core/cost'
import { useConversationStore } from '../stores/conversation'
import { useSettingsStore } from '../stores/settings'
import { useUIStore, type ActionSheetItem } from '../stores/ui'
import type { MessageNode } from '../types'
import { copyText } from '../utils/clipboard'
import { formatTokens } from '../utils/format'
import { markdownToPlainText } from '../utils/markdown'
import { normalizeModel } from '../utils/model'
import MarkdownRenderer from './MarkdownRenderer.vue'
import VersionIndicator from './VersionIndicator.vue'

const props = defineProps<{
  node: MessageNode
  siblings: MessageNode[]
  isStreaming?: boolean
  showCost?: boolean
  isCandidate?: boolean
}>()

const emit = defineEmits<{ selectVersion: [id: string] }>()

const convStore = useConversationStore()
const settingsStore = useSettingsStore()
const uiStore = useUIStore()

const currentConv = computed(() => convStore.conversations.find((c) => c.id === convStore.currentId))
const aiAvatar = computed(() => currentConv.value?.avatar || settingsStore.settings.avatar)
const userAvatar = computed(() => currentConv.value?.userAvatar || settingsStore.settings.userAvatar)

// 费用按当前单价实时重算（改价后旧消息也能更新）；峰谷按消息生成时刻判断
// 旧消息 model 可能是已弃用的 chat/reasoner，映射到 v4-flash 计费
const displayCost = computed(() => {
  if (!props.node.usage || !props.node.model) return null
  const price = settingsStore.settings.prices[normalizeModel(props.node.model)] ?? { in: 0, out: 0, cacheHit: 0 }
  return computeCost(props.node.usage, price, settingsStore.settings.peakRule, new Date(props.node.createdAt))
})

const reasoningOpen = ref(false)
const showReasoning = () =>
  props.node.role === 'assistant' && !!props.node.reasoning && props.node.reasoning.length > 0

// ---- 长按 / 右键操作菜单 ----
let pressTimer: number | null = null

function openMenu() {
  const n = props.node
  if (n.role === 'user') {
    uiStore.openActionSheet([
      { label: '编辑此输入', onClick: () => editUser() },
      { label: '复制', onClick: () => void copyLabel(n.content) },
      { label: '删除', danger: true, onClick: () => confirmDelete() },
    ])
  } else {
    const items: ActionSheetItem[] = [
      { label: '复制 · 纯文本', onClick: () => void copyLabel(markdownToPlainText(n.content)) },
      { label: '复制 · Markdown', onClick: () => void copyLabel(n.content) },
    ]
    if (n.reasoning) {
      items.push({ label: '复制 · 思维链', onClick: () => void copyLabel(n.reasoning ?? '') })
    }
    items.push(
      { label: '修改回复', onClick: () => editAssistant() },
      {
        label: '刷新',
        onClick: () => {
          if (n.parentId) void convStore.refreshAIReply(n.parentId)
        },
      },
      { label: '删除', danger: true, onClick: () => confirmDelete() },
    )
    uiStore.openActionSheet(items)
  }
}

async function copyLabel(text: string) {
  const ok = await copyText(text)
  uiStore.showToast(ok ? '已复制' : '复制失败')
}

function editUser() {
  uiStore.openEditor({
    title: '编辑用户输入',
    value: props.node.content,
    mode: 'text',
    onConfirm: (v) => {
      if (v !== props.node.content) void convStore.editUserMessage(props.node.id, v)
    },
  })
}

function editAssistant() {
  uiStore.openEditor({
    title: '修改 AI 回复',
    value: props.node.content,
    reasoning: props.node.reasoning,
    mode: 'assistant',
    onConfirm: (v, reasoning) => void convStore.editAIReply(props.node.id, v, reasoning),
  })
}

function confirmDelete() {
  if (window.confirm('删除该消息及其全部后续分支？')) {
    void convStore.deleteSubtree(props.node.id)
  }
}

function onPressStart() {
  pressTimer = window.setTimeout(openMenu, 500)
}
function onPressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}
function onCtxMenu(e: MouseEvent) {
  e.preventDefault()
  openMenu()
}
</script>

<template>
  <div
    class="flex w-full items-start gap-2"
    :class="node.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <!-- AI 头像（左） -->
    <div
      v-if="node.role === 'assistant'"
      class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10"
    >
      <img
        v-if="aiAvatar"
        :src="aiAvatar"
        class="h-full w-full object-cover"
        alt="AI"
      />
      <span v-else class="text-base">🤖</span>
    </div>

    <div class="flex max-w-[75%] flex-col" :class="node.role === 'user' ? 'items-end' : 'items-start'">
      <!-- 版本指示器（同父兄弟 ≥ 2 时显示） -->
      <div v-if="siblings.length > 1" class="mb-0.5 px-1">
        <VersionIndicator :current-id="node.id" :siblings="siblings" @select="emit('selectVersion', $event)" />
      </div>

      <!-- 气泡 -->
      <div
        class="rounded-2xl px-3.5 py-2.5 text-sm select-none"
        :class="
          isCandidate
            ? 'border border-dashed border-sub/50 bg-white/60 text-sub'
            : node.role === 'user'
              ? 'rounded-tr-md bg-bubble-user'
              : 'rounded-tl-md bg-bubble-ai'
        "
        @touchstart.passive="onPressStart"
        @touchend="onPressEnd"
        @touchmove.passive="onPressEnd"
        @contextmenu.prevent="onCtxMenu"
      >
        <!-- 思维链（可折叠） -->
        <div v-if="showReasoning()" class="mb-1.5">
          <button
            class="flex items-center gap-1 text-xs text-sub"
            @click="reasoningOpen = !reasoningOpen"
          >
            <span>🧠 思维链</span>
            <span>{{ reasoningOpen ? '▲' : '▼' }}</span>
          </button>
          <div
            v-if="reasoningOpen"
            class="mt-1 whitespace-pre-wrap break-words rounded bg-reasoning px-2 py-1.5 text-xs text-sub"
          >
            {{ node.reasoning }}
          </div>
        </div>

        <!-- 内容：assistant 非流式渲染 Markdown；流式/user 显示纯文本 -->
        <MarkdownRenderer
          v-if="node.role === 'assistant' && !isStreaming && node.content"
          :source="node.content"
        />
        <div v-else class="whitespace-pre-wrap break-words">{{ node.content }}</div>

        <!-- 流式光标 -->
        <span v-if="isStreaming" class="streaming-caret">▍</span>
      </div>

      <!-- 费用 -->
      <div v-if="showCost && node.usage" class="mt-0.5 px-1 text-xs text-sub">
        ↑{{ formatTokens(node.usage.promptTokens) }} ↓{{ formatTokens(node.usage.completionTokens) }}
        {{ formatCost(displayCost ?? 0) }}
      </div>
    </div>

    <!-- 用户头像（右） -->
    <div
      v-if="node.role === 'user'"
      class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bubble-user/50"
    >
      <img
        v-if="userAvatar"
        :src="userAvatar"
        class="h-full w-full object-cover"
        alt="用户"
      />
      <span v-else class="text-base">🧑</span>
    </div>
  </div>
</template>

<style scoped>
.streaming-caret {
  animation: blink 1s infinite;
  color: #576b95;
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
