<script setup lang="ts">
import { ref } from 'vue'
import { useConversationStore } from '../stores/conversation'

const convStore = useConversationStore()
const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

async function send() {
  const content = text.value.trim()
  if (!content || convStore.isStreaming) return
  text.value = ''
  textareaRef.value && (textareaRef.value.style.height = 'auto')
  await convStore.sendUserMessage(content)
}

function pause() {
  convStore.pauseStream()
}
</script>

<template>
  <div class="flex items-end gap-2 bg-white p-3 safe-bottom" style="border-top: 0.5px solid #e5e5e5">
    <textarea
      ref="textareaRef"
      v-model="text"
      rows="1"
      placeholder="输入消息…"
      class="max-h-50 min-w-0 flex-1 resize-none rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
      @input="autoResize"
      @keydown.enter.exact.prevent="send"
      @keydown.enter.shift.prevent
    ></textarea>

    <button
      v-if="convStore.isStreaming"
      class="h-9 shrink-0 rounded-full bg-danger px-4 text-sm text-white active:opacity-70"
      @click="pause"
    >
      暂停
    </button>
    <button
      v-else
      class="h-9 shrink-0 rounded-full px-4 text-sm active:opacity-70 disabled:opacity-40"
      :class="text.trim() ? 'bg-accent text-white' : 'bg-line text-sub'"
      :disabled="!text.trim()"
      @click="send"
    >
      发送
    </button>
  </div>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
