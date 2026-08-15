<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { applyRegex } from '../core/context'
import { useUIStore } from '../stores/ui'

const ui = useUIStore()

const text = ref('')
const reasoning = ref('')
const testInput = ref('')

watch(
  () => ui.editor.visible,
  (v) => {
    if (v) {
      text.value = ui.editor.value
      reasoning.value = ui.editor.reasoning ?? ''
      testInput.value = ''
    }
  },
)

const testOutput = computed(() => applyRegex(testInput.value, text.value))

function confirm() {
  ui.editor.onConfirm(text.value, ui.editor.mode === 'assistant' ? reasoning.value : undefined)
  ui.closeEditor()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.editor.visible" class="safe-area-x fixed inset-0 z-50 flex flex-col bg-white">
      <!-- 顶栏 -->
      <header class="safe-area-top flex h-14 shrink-0 items-center justify-between px-4">
        <button class="text-xl text-sub active:opacity-60" aria-label="关闭" @click="ui.closeEditor()">
          ✕
        </button>
        <span class="font-semibold">{{ ui.editor.title }}</span>
        <button class="text-accent active:opacity-60" @click="confirm">✓</button>
      </header>

      <!-- 正文 -->
      <main class="safe-area-bottom flex min-h-0 flex-1 flex-col">
        <textarea
          v-model="text"
          class="min-h-0 flex-1 resize-none bg-bg p-4 text-sm outline-none"
          placeholder="输入内容…"
          spellcheck="false"
        ></textarea>

        <!-- assistant 编辑：思维链 -->
        <template v-if="ui.editor.mode === 'assistant'">
          <div class="shrink-0 px-4 pb-1 pt-2 text-xs text-sub">🧠 思维链（可留空）</div>
          <textarea
            v-model="reasoning"
            rows="3"
            class="shrink-0 resize-none bg-reasoning px-4 py-2 text-xs outline-none"
            placeholder="思维链内容…"
            spellcheck="false"
          ></textarea>
        </template>

        <!-- 正则实时测试区 -->
        <div v-if="ui.editor.regexTest" class="shrink-0 border-t border-line px-4 py-3">
          <div class="mb-1 text-xs text-sub">正则实时测试（输入模拟 AI 输出）</div>
          <input
            v-model="testInput"
            class="w-full rounded bg-bg px-3 py-2 text-xs outline-none"
            placeholder="模拟 AI 返回的内容…"
          />
          <div class="mt-1 rounded bg-bg px-3 py-2 text-xs break-words">
            <span class="text-sub">输出：</span>{{ testOutput }}
          </div>
        </div>
      </main>
    </div>
  </Teleport>
</template>

<style scoped></style>
