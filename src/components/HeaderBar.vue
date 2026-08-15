<script setup lang="ts">
/**
 * 微信风格页头：左侧返回箭头 + 居中标题 + 右侧插槽
 */
defineProps<{ title?: string; backTo?: string }>()
</script>

<template>
  <header
    class="safe-area-top safe-area-x relative flex h-14 shrink-0 items-center bg-white px-3"
    style="border-bottom: 0.5px solid #e5e5e5"
  >
    <div class="flex flex-1 items-center justify-start">
      <slot name="left">
        <RouterLink v-if="backTo" :to="backTo" class="px-1 text-[17px] text-ink active:opacity-60" aria-label="返回">
          ‹
        </RouterLink>
      </slot>
    </div>
    <span class="min-w-0 max-w-[50%] truncate text-center text-[17px] font-medium text-ink">{{ title }}</span>
    <div class="flex flex-1 items-center justify-end">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped></style>
