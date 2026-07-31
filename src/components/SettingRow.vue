<script setup lang="ts">
/**
 * 微信风格设置行：左侧 label（黑），右侧 value（灰）+ 箭头 >
 * - clickable 时整行可点，active 态变浅灰
 * - 分割线由 SettingGroup 的 CSS 统一处理（左缩进对齐文字）
 */
defineProps<{
  label: string
  value?: string
  clickable?: boolean
  danger?: boolean
  /** 右侧是否显示箭头，默认 clickable 时显示 */
  arrow?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div
    class="setting-row flex min-h-13 items-center gap-3 px-4"
    :class="clickable ? 'cursor-pointer active:bg-bg' : ''"
    @click="clickable && emit('click')"
  >
    <span class="shrink-0 text-[15px]" :class="danger ? 'text-danger' : 'text-ink'">{{ label }}</span>
    <span class="min-w-0 flex-1 truncate text-right text-[15px] text-sub">{{ value ?? '' }}</span>
    <slot />
    <span v-if="arrow ?? clickable" class="shrink-0 text-[15px] text-[#c7c7cc]">›</span>
  </div>
</template>

<style>
/* 微信风格细分隔线：左缩进对齐文字（16px），右通栏 */
.setting-group .setting-row {
  position: relative;
}
.setting-group .setting-row:not(:first-child)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 0;
  border-top: 0.5px solid #e5e5e5;
}
</style>
