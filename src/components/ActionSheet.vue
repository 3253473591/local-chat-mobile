<script setup lang="ts">
import { useUIStore } from '../stores/ui'

const ui = useUIStore()

function onItemClick(index: number) {
  const item = ui.actionSheetItems[index]
  ui.closeActionSheet()
  item?.onClick()
}
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩 -->
    <Transition name="fade">
      <div
        v-if="ui.actionSheetVisible"
        class="fixed inset-0 z-40 bg-black/40"
        @click="ui.closeActionSheet()"
      ></div>
    </Transition>

    <!-- 底部菜单 -->
    <Transition name="slide-up">
      <div
        v-if="ui.actionSheetVisible"
        class="safe-area-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-white pb-4"
      >
        <div class="flex flex-col p-2">
          <button
            v-for="(item, i) in ui.actionSheetItems"
            :key="i"
            class="rounded-lg py-3 text-center text-sm active:bg-bg"
            :class="item.danger ? 'text-danger' : 'text-ink'"
            @click="onItemClick(i)"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="px-2">
          <button
            class="w-full rounded-lg bg-bg py-3 text-center text-sm text-ink active:opacity-70"
            @click="ui.closeActionSheet()"
          >
            取消
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
