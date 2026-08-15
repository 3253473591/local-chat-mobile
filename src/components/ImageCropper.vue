<script setup lang="ts">
/**
 * 图片裁剪：锁定比例（头像 1:1 / 聊天背景 9:16），拖拽移动 + 双指/滚轮缩放，
 * 确认后渲染裁剪区域为 JPEG dataURL 并 emit('confirm')。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  file: File
  /** 宽高比（宽/高）：头像 1；聊天背景 9/16 */
  aspect: number
}>()
const emit = defineEmits<{ confirm: [dataUrl: string]; cancel: [] }>()

const maxZoom = 5

const viewportRef = ref<HTMLElement | null>(null)
const frameEl = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const src = ref('')
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const frameW = ref(0)
const frameH = ref(0)

let img: HTMLImageElement | null = null
let coverScale = 1
let centered = false
let objectUrl = ''
let ro: ResizeObserver | null = null

const dispW = computed(() => (img?.naturalWidth ?? 0) * coverScale * zoom.value)
const dispH = computed(() => (img?.naturalHeight ?? 0) * coverScale * zoom.value)

function scale(): number {
  return coverScale * zoom.value
}
function clampZoom(v: number): number {
  return Math.min(maxZoom, Math.max(1, v))
}

/** 以裁剪框内坐标 (ax, ay) 为固定锚点设置缩放（用于滑块/滚轮/双指） */
function setZoom(newZoom: number, ax: number, ay: number) {
  const z = clampZoom(newZoom)
  const oldScale = scale()
  const newScale = coverScale * z
  const imgX = (ax - offsetX.value) / oldScale
  const imgY = (ay - offsetY.value) / oldScale
  zoom.value = z
  offsetX.value = ax - imgX * newScale
  offsetY.value = ay - imgY * newScale
  clamp()
}

/** 约束图片位置：始终覆盖裁剪框 */
function clamp() {
  const w = dispW.value
  const h = dispH.value
  offsetX.value = Math.min(0, Math.max(frameW.value - w, offsetX.value))
  offsetY.value = Math.min(0, Math.max(frameH.value - h, offsetY.value))
}

function computeFrame() {
  const vp = viewportRef.value
  if (!vp) return
  const vw = vp.clientWidth
  const vh = vp.clientHeight
  const pad = 24
  let w = Math.max(0, vw - pad)
  let h = w / props.aspect
  if (h > vh - pad) {
    h = Math.max(0, vh - pad)
    w = h * props.aspect
  }
  frameW.value = w
  frameH.value = h
  if (img) {
    coverScale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    if (!centered) {
      centered = true
      zoom.value = 1
      offsetX.value = (w - img.naturalWidth * coverScale) / 2
      offsetY.value = (h - img.naturalHeight * coverScale) / 2
    } else {
      clamp()
    }
  }
}

function onImgLoad() {
  img = imgEl.value
  computeFrame()
}

// —— 手势（Pointer Events 统一鼠标/触屏，多指 = 双指缩放）——
type Gesture =
  | { mode: 'drag'; startX: number; startY: number; startOffsetX: number; startOffsetY: number }
  | { mode: 'pinch'; dist: number; midX: number; midY: number }

const pointers = new Map<number, { x: number; y: number }>()
let gesture: Gesture | null = null

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  viewportRef.value?.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    gesture = {
      mode: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetX.value,
      startOffsetY: offsetY.value,
    }
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()]
    gesture = {
      mode: 'pinch',
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId) || !gesture) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (gesture.mode === 'drag' && pointers.size === 1) {
    offsetX.value = gesture.startOffsetX + (e.clientX - gesture.startX)
    offsetY.value = gesture.startOffsetY + (e.clientY - gesture.startY)
    clamp()
  } else if (gesture.mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const rect = frameEl.value?.getBoundingClientRect()
    if (gesture.dist > 0 && rect) {
      // 平移跟随双指中点，缩放以当前中点为锚
      offsetX.value += midX - gesture.midX
      offsetY.value += midY - gesture.midY
      setZoom(zoom.value * (dist / gesture.dist), midX - rect.left, midY - rect.top)
      clamp()
    }
    gesture.dist = dist
    gesture.midX = midX
    gesture.midY = midY
  }
}

function onPointerEnd(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size === 0) {
    gesture = null
  } else if (pointers.size === 1) {
    const [p] = [...pointers.values()]
    gesture = {
      mode: 'drag',
      startX: p.x,
      startY: p.y,
      startOffsetX: offsetX.value,
      startOffsetY: offsetY.value,
    }
  } else {
    const [p1, p2] = [...pointers.values()]
    gesture = {
      mode: 'pinch',
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
    }
  }
}

function onWheel(e: WheelEvent) {
  const rect = frameEl.value?.getBoundingClientRect()
  if (!rect) return
  const factor = Math.exp(-e.deltaY * 0.002)
  setZoom(zoom.value * factor, e.clientX - rect.left, e.clientY - rect.top)
}

function onSlider() {
  setZoom(zoom.value, frameW.value / 2, frameH.value / 2)
}

const processing = ref(false)

/** 同步渲染裁剪结果（drawImage + JPEG 编码较耗时，需先展示"处理中"再调用） */
function renderCrop(): string | null {
  const el = imgEl.value
  if (!el || !frameW.value) return null
  const s = scale()
  const srcX = -offsetX.value / s
  const srcY = -offsetY.value / s
  const srcW = frameW.value / s
  const srcH = frameH.value / s
  const longSide = 1024
  const outW = props.aspect >= 1 ? longSide : Math.round(longSide * props.aspect)
  const outH = props.aspect >= 1 ? Math.round(longSide / props.aspect) : longSide
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  // 低质量平滑 + 0.85 压缩：大幅缩短主线程耗时（头像/背景显示尺寸小，肉眼无差异）
  ctx.imageSmoothingQuality = 'low'
  ctx.drawImage(el, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function onConfirm() {
  if (processing.value) return
  processing.value = true
  // 先让"处理中"遮罩渲染一帧，再执行耗时裁剪，避免黑屏期间无任何反馈
  setTimeout(() => {
    const dataUrl = renderCrop()
    processing.value = false
    if (dataUrl) emit('confirm', dataUrl)
  }, 30)
}

onMounted(() => {
  objectUrl = URL.createObjectURL(props.file)
  src.value = objectUrl
  ro = new ResizeObserver(() => computeFrame())
  if (viewportRef.value) ro.observe(viewportRef.value)
  window.addEventListener('resize', computeFrame)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', computeFrame)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex flex-col bg-black" style="overscroll-behavior: none">
      <!-- 顶栏 -->
      <header class="safe-area-top flex h-14 shrink-0 items-center justify-between px-4">
        <button class="text-xl text-white/70 active:opacity-60" aria-label="取消" :disabled="processing" @click="emit('cancel')">✕</button>
        <span class="text-[15px] font-medium text-white">{{ props.aspect >= 1 ? '裁剪头像（1:1）' : '裁剪背景（9:16）' }}</span>
        <button class="text-[17px] text-accent active:opacity-60" :disabled="processing" @click="onConfirm">
          {{ processing ? '…' : '完成' }}
        </button>
      </header>

      <!-- 处理中遮罩（同步裁剪会短暂阻塞主线程，先展示提示） -->
      <div
        v-if="processing"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
        <div class="text-sm text-white/80">正在处理…</div>
      </div>

      <!-- 裁剪区：黑色遮罩 + 白色边框裁剪框 -->
      <div
        ref="viewportRef"
        class="relative min-h-0 flex-1 select-none"
        style="touch-action: none"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @wheel.prevent="onWheel"
      >
        <div
          ref="frameEl"
          class="relative overflow-hidden border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          :style="{ width: frameW + 'px', height: frameH + 'px' }"
        >
          <img
            ref="imgEl"
            :src="src"
            draggable="false"
            alt="待裁剪"
            class="absolute left-0 top-0 max-w-none"
            :style="{
              width: dispW + 'px',
              height: dispH + 'px',
              transform: `translate(${offsetX}px, ${offsetY}px)`,
              willChange: 'transform',
            }"
            @load="onImgLoad"
          />
        </div>
      </div>

      <!-- 底部：缩放滑块 -->
      <div class="safe-area-bottom shrink-0 px-6 py-5">
        <div class="mb-3 text-center text-xs text-white/50">拖动移动 · 双指 / 滚轮缩放</div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-white/40">−</span>
          <input
            v-model.number="zoom"
            type="range"
            :min="1"
            :max="maxZoom"
            step="0.01"
            class="min-w-0 flex-1 accent-accent"
            @input="onSlider"
          />
          <span class="w-10 text-right text-xs tabular-nums text-white/70">{{ Math.round(zoom * 100) }}%</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped></style>
