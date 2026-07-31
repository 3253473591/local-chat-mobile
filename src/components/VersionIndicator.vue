<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MessageNode } from '../types'

const props = defineProps<{
  currentId: string
  siblings: MessageNode[]
}>()

const emit = defineEmits<{ select: [id: string] }>()

const open = ref(false)

const currentIndex = () => props.siblings.findIndex((s) => s.id === props.currentId)
const label = () => `版本 ${currentIndex() + 1}/${props.siblings.length}`

function toggle(e: MouseEvent) {
  e.stopPropagation()
  open.value = !open.value
}

function choose(id: string) {
  open.value = false
  emit('select', id)
}

function onDocClick() {
  open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="relative inline-block">
    <button class="text-xs text-sub active:opacity-60" @click.stop="toggle">{{ label() }} ▾</button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-20 mt-1 max-h-56 w-52 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg"
      @click.stop
    >
      <button
        v-for="s in siblings"
        :key="s.id"
        class="block w-full truncate px-3 py-1.5 text-left text-xs active:bg-bg"
        :class="s.id === currentId ? 'text-accent font-semibold' : 'text-ink'"
        @click="choose(s.id)"
      >
        {{ s.versionIndex }}/{{ siblings.length }}：{{ s.content.slice(0, 24) || '（空）' }}
      </button>
    </div>
  </div>
</template>
