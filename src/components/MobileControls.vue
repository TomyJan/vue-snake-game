<template>
  <div class="mobile-controls">
    <div class="dpad">
      <button class="dpad-btn up" @touchstart.prevent="press('up')" @mousedown.prevent="press('up')">▲</button>
      <button class="dpad-btn left" @touchstart.prevent="press('left')" @mousedown.prevent="press('left')">◄</button>
      <button class="dpad-btn right" @touchstart.prevent="press('right')" @mousedown.prevent="press('right')">►</button>
      <button class="dpad-btn down" @touchstart.prevent="press('down')" @mousedown.prevent="press('down')">▼</button>
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
}

@media (max-width: 600px), (pointer: coarse) {
  .mobile-controls {
    display: flex;
  }
}

.dpad {
  display: grid;
  grid-template-areas:
    '. up .'
    'left . right'
    '. down .';
  gap: 4px;
}

.dpad-btn {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 2px solid var(--card-border);
  background: var(--card);
  color: var(--text);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

.dpad-btn:active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.dpad-btn.up { grid-area: up; }
.dpad-btn.down { grid-area: down; }
.dpad-btn.left { grid-area: left; }
.dpad-btn.right { grid-area: right; }
</style>
