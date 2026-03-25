<template>
  <div
    v-if="active"
    class="joystick-overlay"
    @touchmove.prevent
    @touchend="onRelease"
    @touchcancel="onRelease"
  >
    <div class="joystick-base" :style="{ left: originX + 'px', top: originY + 'px' }">
      <div
        class="joystick-thumb"
        :style="{ transform: `translate(${thumbX}px, ${thumbY}px)` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Direction } from '../types/game'

const props = defineProps<{
  gameStatus: string
}>()

const emit = defineEmits<{
  direction: [dir: Direction]
}>()

const active = ref(false)
const originX = ref(0)
const originY = ref(0)
const thumbX = ref(0)
const thumbY = ref(0)

const MAX_RADIUS = 40
const DEAD_ZONE = 10
let currentTouchId: number | null = null

function onTouchStart(e: TouchEvent) {
  // Only activate during gameplay
  if (props.gameStatus !== 'playing') return

  // Ignore if touching buttons/controls
  const target = e.target as HTMLElement
  if (target.closest('button, select, a, details, .game-controls, .controls-help, .version')) return

  const touch = e.changedTouches[0]
  currentTouchId = touch.identifier
  originX.value = touch.clientX
  originY.value = touch.clientY
  thumbX.value = 0
  thumbY.value = 0
  active.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!active.value) return
  const touch = Array.from(e.changedTouches).find((t) => t.identifier === currentTouchId)
  if (!touch) return

  let dx = touch.clientX - originX.value
  let dy = touch.clientY - originY.value

  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > MAX_RADIUS) {
    dx = (dx / dist) * MAX_RADIUS
    dy = (dy / dist) * MAX_RADIUS
  }

  thumbX.value = dx
  thumbY.value = dy

  if (dist > DEAD_ZONE) {
    if (Math.abs(dx) > Math.abs(dy)) {
      emit('direction', dx > 0 ? 'right' : 'left')
    } else {
      emit('direction', dy > 0 ? 'down' : 'up')
    }
  }
}

function onRelease() {
  active.value = false
  thumbX.value = 0
  thumbY.value = 0
  currentTouchId = null
}

onMounted(() => {
  document.addEventListener('touchstart', onTouchStart, { passive: false })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
})

onUnmounted(() => {
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchmove', onTouchMove)
})
</script>

<style scoped>
.joystick-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  touch-action: none;
}

.joystick-base {
  position: fixed;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.15);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.joystick-thumb {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.4);
  top: 50%;
  left: 50%;
  margin-top: -22px;
  margin-left: -22px;
  transition: none;
  pointer-events: none;
}

@media (pointer: fine) {
  .joystick-overlay {
    display: none !important;
  }
}
</style>
