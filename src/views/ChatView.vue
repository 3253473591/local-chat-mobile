<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Composer from '../components/Composer.vue'
import HeaderBar from '../components/HeaderBar.vue'
import MessageBubble from '../components/MessageBubble.vue'
import { childrenOf } from '../core/tree'
import { useConversationStore } from '../stores/conversation'
import { useSettingsStore } from '../stores/settings'

const route = useRoute()
const router = useRouter()
const convStore = useConversationStore()
const settingsStore = useSettingsStore()

const bottomRef = ref<HTMLElement | null>(null)

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

// 路径变化 / 流式内容变化时滚动到底部
watch(
  () => [
    JSON.stringify(convStore.activePath),
    convStore.isStreaming,
    convStore.streamingNodeId,
    convStore.streamingNodeId ? convStore.nodes[convStore.streamingNodeId]?.content ?? '' : '',
  ],
  () => scrollToBottom(),
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
</script>

<template>
  <div class="flex h-full flex-col">
    <HeaderBar :title="currentTitle">
      <template #left>
        <button class="px-1 text-[17px] text-ink active:opacity-60" aria-label="返回" @click="goHome">‹</button>
      </template>
      <template #right>
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
      class="flex-1 overflow-y-auto bg-bg px-3 py-3"
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

    <Composer />
  </div>
</template>
