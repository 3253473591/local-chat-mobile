<script setup lang="ts">
import { useRouter } from 'vue-router'
import HeaderBar from '../components/HeaderBar.vue'
import { useConversationStore } from '../stores/conversation'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { formatTime } from '../utils/format'

const convStore = useConversationStore()
const settingsStore = useSettingsStore()
const uiStore = useUIStore()
const router = useRouter()

async function handleNew() {
  try {
    const id = await convStore.createConversation()
    await convStore.enterConversation(id)
    // 带 new=1 标记：进入后自动跳转 AI 增强页（选择模型/提示词/正则/X轮）
    router.push({ path: `/chat/${id}`, query: { new: '1' } })
  } catch (e) {
    uiStore.showToast(`新建失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleEnter(id: string) {
  try {
    await convStore.enterConversation(id)
    router.push(`/chat/${id}`)
  } catch (e) {
    uiStore.showToast(`进入失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleRename(id: string) {
  const conv = convStore.conversations.find((c) => c.id === id)
  if (!conv) return
  const title = window.prompt('输入新名称：', conv.title)
  if (title === null) return
  await convStore.renameConversation(id, title)
  uiStore.showToast('已重命名')
}

async function handleDelete(id: string) {
  if (!window.confirm('删除该对话及其全部消息（含所有分支）？')) return
  try {
    await convStore.deleteConversation(id)
    uiStore.showToast('已删除')
  } catch (e) {
    uiStore.showToast(`删除失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

// 长按 / 右键 → 操作菜单
let pressTimer: number | null = null

function openMenu(id: string) {
  const conv = convStore.conversations.find((c) => c.id === id)
  uiStore.openActionSheet([
    { label: '重命名', onClick: () => void handleRename(id) },
    { label: conv?.pinnedAt ? '取消置顶' : '置顶', onClick: () => void convStore.togglePin(id) },
    { label: '删除', danger: true, onClick: () => void handleDelete(id) },
  ])
}

function onPressStart(id: string) {
  pressTimer = window.setTimeout(() => openMenu(id), 500)
}
function onPressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}
function onCtxMenu(e: MouseEvent, id: string) {
  e.preventDefault()
  openMenu(id)
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="对话">
      <template #right>
        <button class="px-1 text-xl text-ink active:opacity-60" aria-label="新建对话" @click="handleNew">＋</button>
      </template>
    </HeaderBar>

    <main class="flex-1 overflow-y-auto">
      <div v-if="convStore.conversations.length === 0" class="py-20 text-center text-sub">
        暂无对话<br />
        <span class="text-xs">点击右上角 ＋ 新建</span>
      </div>

      <div v-else class="bg-white">
        <div
          v-for="c in convStore.conversations"
          :key="c.id"
          class="flex w-full cursor-pointer items-center gap-3 border-b border-line px-4 py-3 text-left select-none active:bg-bg"
          @click="handleEnter(c.id)"
          @touchstart.passive="onPressStart(c.id)"
          @touchend="onPressEnd"
          @touchmove.passive="onPressEnd"
          @contextmenu.prevent="onCtxMenu($event, c.id)"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-accent/10">
            <img
              v-if="c.avatar || settingsStore.settings.avatar"
              :src="c.avatar || settingsStore.settings.avatar"
              class="h-full w-full object-cover"
              alt="AI"
            />
            <span v-else>🤖</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px]">{{ c.pinnedAt ? '📌 ' : '' }}{{ c.title }}</span>
            <span class="block truncate text-xs text-sub">{{ c.model }}</span>
          </span>
          <span class="shrink-0 text-xs text-sub">{{ formatTime(c.updatedAt) }}</span>
        </div>
      </div>
    </main>

    <nav class="safe-area-bottom flex h-14 shrink-0 items-stretch bg-white" style="border-top: 0.5px solid #e5e5e5">
      <RouterLink
        to="/"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs"
        active-class="text-accent"
        exact-active-class="text-accent"
      >
        <span class="text-base">💬</span>
        <span>对话</span>
      </RouterLink>
      <RouterLink
        to="/settings"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs text-sub"
        active-class="text-accent"
      >
        <span class="text-base">⚙️</span>
        <span>设置</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped></style>
