<script setup lang="ts">
/**
 * 微信风格页头：左侧返回箭头 + 居中标题 + 右侧插槽
 */
defineProps<{ title?: string; backTo?: string }>()
</script>

<template>
  <header class="flex h-12 shrink-0 items-center bg-white px-3 safe-top" style="border-bottom: 0.5px solid #e5e5e5">
    <slot name="left">
      <RouterLink v-if="backTo" :to="backTo" class="px-1 text-[17px] text-ink active:opacity-60" aria-label="返回">
        ‹
      </RouterLink>
    </slot>
    <span class="min-w-0 flex-1 truncate text-center text-[17px] font-medium text-ink">{{ title }}</span>
    <slot name="right" />
  </header>
</template>

<style scoped>
.safe-top {
  padding-top: env(safe-area-inset-top);
}
</style>
