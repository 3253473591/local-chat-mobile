<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ActionSheet from './components/ActionSheet.vue'
import FullscreenEditor from './components/FullscreenEditor.vue'
import { useConversationStore } from './stores/conversation'
import { useSettingsStore } from './stores/settings'
import { useUIStore } from './stores/ui'

const settingsStore = useSettingsStore()
const convStore = useConversationStore()
const uiStore = useUIStore()

onMounted(async () => {
  await settingsStore.loadSettings()
  await convStore.loadConversations()
})
</script>

<template>
  <div class="app-root bg-bg text-ink">
    <RouterView />
    <Transition name="fade">
      <div v-if="uiStore.toast" class="toast">{{ uiStore.toast }}</div>
    </Transition>

    <!-- 全局弹层 -->
    <ActionSheet />
    <FullscreenEditor />
  </div>
</template>

<style scoped>
.app-root {
  max-width: 430px;
  margin: 0 auto;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 100px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 50;
  pointer-events: none;
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
