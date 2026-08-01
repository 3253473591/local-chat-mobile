<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Composer from '../components/Composer.vue'
import HeaderBar from '../components/HeaderBar.vue'
import MessageBubble from '../components/MessageBubble.vue'
import { childrenOf } from '../core/tree'
import { useConversationStore } from '../stores/conversation'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const convStore = useConversationStore()
const settingsStore = useSettingsStore()
const uiStore = useUIStore()

const bottomRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
/** 是否位于底部附近（决定流式输出时是否自动跟随） */
const nearBottom = ref(true)
/** 流式结束时用户不在底部 → 显示"到底部"按钮 */
const streamEndedWhileAway = ref(false)
const NEAR_BOTTOM_THRESHOLD = 100

function updateNearBottom() {
  const el = scrollRef.value
  if (!el) return
  nearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD
  if (nearBottom.value) streamEndedWhileAway.value = false
}

onMounted(async () => {
  const id = route.params.id as string
  if (convStore.currentId !== id) {
    await convStore.enterConversation(id)
  }
  scrollToBottom(true)
  // 新建对话（带 new=1）→ 自动进入 AI 增强页
  if (route.query.new === '1') {
    void router.replace({ path: `/chat/${id}/enhance` })
  }
})

function goHome() {
  router.push('/')
}

const pathNodes = computed(() =>
  convStore.activePath.map((id) => convStore.nodes[id]).filter((n): n is NonNullable<typeof n> => Boolean(n)),
)

const currentTitle = computed(
  () => convStore.conversations.find((c) => c.id === route.params.id)?.title ?? '对话',
)

function siblingsOf(id: string) {
  const node = convStore.nodes[id]
  if (!node) return []
  return childrenOf(convStore.nodes, node.parentId)
}

function scrollToBottom(instant = false) {
  void nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' })
  })
}

function onJumpDown() {
  streamEndedWhileAway.value = false
  nearBottom.value = true
  scrollToBottom(true)
}

/** 未在底部且流式输出中 / 刚流式结束时，显示"到底部"悬浮按钮 */
const showJumpDown = computed(
  () => !nearBottom.value && (convStore.isStreaming || streamEndedWhileAway.value),
)

// 路径变化 / 流式开始 / 流式结束：分情况滚动
watch(
  () => [JSON.stringify(convStore.activePath), convStore.streamingNodeId],
  ([pathStr, sid], [oldPathStr, oldSid]) => {
    const started = Boolean(sid) && sid !== oldSid
    const ended = !sid && Boolean(oldSid)
    if (started) {
      scrollToBottom() // 刚发送消息 / 刷新 → 跟随到底
      return
    }
    if (ended) {
      // 流式结束：在底部则归位；上滑阅读中则不打扰
      if (nearBottom.value) scrollToBottom(true)
      else streamEndedWhileAway.value = true
      return
    }
    if (!sid && pathStr !== oldPathStr) {
      scrollToBottom() // 切换版本 / 延伸 / 删除等路径变化
    }
  },
)

// 流式内容增长：仅在用户位于底部附近时自动跟随（上滑阅读时不被拉扯）
watch(
  () => (convStore.streamingNodeId ? convStore.nodes[convStore.streamingNodeId]?.content ?? '' : ''),
  () => {
    if (nearBottom.value && convStore.isStreaming) scrollToBottom(true)
  },
)

function onSelectVersion(id: string) {
  convStore.switchVersion(id)
  scrollToBottom(true)
}

function onCandidateClick(id: string) {
  convStore.extendPath(id)
  scrollToBottom(true)
}

const bgImage = computed(() => {
  const conv = convStore.conversations.find((c) => c.id === route.params.id)
  return conv?.bgImage || settingsStore.settings.bgImage
})

const aiAvatar = computed(() => {
  const conv = convStore.conversations.find((c) => c.id === route.params.id)
  return conv?.avatar || settingsStore.settings.avatar
})

function openEnhance() {
  router.push(`/chat/${route.params.id}/enhance`)
}

async function handleClearChat() {
  if (!window.confirm('清空当前对话的全部消息（不可恢复）？')) return
  await convStore.clearConversation()
  uiStore.showToast('已清空')
}
</script>

<template>
  <div class="relative flex h-full flex-col">
    <HeaderBar :title="currentTitle">
      <template #left>
        <button class="px-1 text-[17px] text-ink active:opacity-60" aria-label="返回" @click="goHome">‹</button>
      </template>
      <template #right>
        <button
          class="px-1 text-xs text-sub active:opacity-60"
          aria-label="清空聊天"
          @click="handleClearChat"
        >
          清空
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full active:opacity-60"
          aria-label="AI 设置"
          @click="openEnhance"
        >
          <img v-if="aiAvatar" :src="aiAvatar" class="h-full w-full object-cover" alt="AI 头像" />
          <span v-else class="text-base">🤖</span>
        </button>
      </template>
    </HeaderBar>

    <main
      ref="scrollRef"
      class="flex-1 overflow-y-auto bg-bg px-3 py-3"
      @scroll.passive="updateNearBottom"
      :style="
        bgImage
          ? { backgroundImage: `url(&quot;${bgImage}&quot;)`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {}
      "
    >
      <div
        v-if="pathNodes.length === 0 && convStore.candidates.length === 0"
        class="py-20 text-center text-sub"
      >
        输入消息开始对话
      </div>

      <template v-for="n in pathNodes" :key="n.id">
        <MessageBubble
          :node="n"
          :siblings="siblingsOf(n.id)"
          :is-streaming="convStore.streamingNodeId === n.id"
          :show-cost="settingsStore.settings.costTracking"
          @select-version="onSelectVersion"
        />
      </template>

      <!-- 候选行：尾部节点的直接子节点 -->
      <template v-for="c in convStore.candidates" :key="c.id">
        <div class="cursor-pointer" @click="onCandidateClick(c.id)">
          <MessageBubble :node="c" :siblings="childrenOf(convStore.nodes, c.parentId)" is-candidate />
        </div>
      </template>

      <div ref="bottomRef"></div>
    </main>

    <Transition name="jump">
      <button
        v-if="showJumpDown"
        class="absolute bottom-24 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-lg shadow-lg active:opacity-70"
        aria-label="到底部"
        @click="onJumpDown"
      >
        ↓
      </button>
    </Transition>

    <Composer />
  </div>
</template>

<style scoped>
.jump-enter-active,
.jump-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.jump-enter-from,
.jump-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
