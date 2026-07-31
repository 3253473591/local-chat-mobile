<script setup lang="ts">
/**
 * 微信风格分组容器：白色卡片 + 上下灰色间隔。
 * 行与行的细分隔线由 SettingRow 的 CSS 处理（左缩进对齐文字）。
 */
defineProps<{ title?: string }>()
</script>

<template>
  <div class="mt-2.5">
    <div v-if="title" class="px-4 pb-1.5 pt-1 text-xs text-sub">{{ title }}</div>
    <div class="setting-group bg-white">
      <slot />
    </div>
  </div>
</template>

<style>
.setting-group {
  border-top: 0.5px solid #e5e5e5;
  border-bottom: 0.5px solid #e5e5e5;
}
</style>
