<template>
  <div class="mobile-controls">
    <div class="joystick">
      <button class="j-btn up" @touchstart.prevent="press('up')" @mousedown.prevent="press('up')">
        <span class="arrow">▲</span>
      </button>
      <div class="j-middle">
        <button class="j-btn left" @touchstart.prevent="press('left')" @mousedown.prevent="press('left')">
          <span class="arrow">◄</span>
        </button>
        <div class="j-center"></div>
        <button class="j-btn right" @touchstart.prevent="press('right')" @mousedown.prevent="press('right')">
          <span class="arrow">►</span>
        </button>
      </div>
      <button class="j-btn down" @touchstart.prevent="press('down')" @mousedown.prevent="press('down')">
        <span class="arrow">▼</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Direction } from '../types/game'

const emit = defineEmits<{
  direction: [dir: Direction]
}>()

function press(dir: Direction) {
  emit('direction', dir)
}
</script>

<style scoped>
.mobile-controls {
  display: none;
  justify-content: center;
  margin-top: 16px;
  user-select: none;
  -webkit-user-select: none;
}

@media (max-width: 600px), (pointer: coarse) {
  .mobile-controls {
    display: flex;
  }
}

.joystick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.j-middle {
  display: flex;
  align-items: center;
  gap: 4px;
}

.j-center {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--card);
  border: 2px solid var(--card-border);
  opacity: 0.5;
}

.j-btn {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  border: 2px solid var(--card-border);
  background: var(--card);
  color: var(--text);
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: all 0.1s;
}

.j-btn:active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  transform: scale(0.92);
}

.arrow {
  pointer-events: none;
}
</style>
