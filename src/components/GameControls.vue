<template>
  <div class="game-controls">
    <button
      v-if="status === 'idle'"
      class="btn btn-primary"
      @click="$emit('start')"
    >
      ▶ Start Game
    </button>
    <button
      v-if="status === 'starting'"
      class="btn"
      disabled
    >
      ⏳ Starting...
    </button>
    <template v-if="status === 'playing' || status === 'paused'">
      <button
        class="btn"
        @click="$emit('toggle-pause')"
      >
        {{ status === 'playing' ? '⏸ Pause' : '▶ Resume' }}
      </button>
      <button
        class="btn btn-danger"
        @click="$emit('restart')"
      >
        ↻ Restart
      </button>
    </template>
    <template v-if="status === 'gameover'">
      <button
        class="btn btn-primary"
        @click="$emit('restart')"
      >
        ↻ Play Again
      </button>
    </template>
    <div class="side-controls">
      <button
        class="btn"
        :class="{ 'btn-active': aiEnabled }"
        :title="aiEnabled ? 'Disable AI' : 'Enable AI Auto-Play'"
        @click="$emit('toggle-ai')"
      >
        {{ aiEnabled ? '🤖 ON' : '🤖 OFF' }}
      </button>
      <button
        class="btn btn-icon"
        :title="soundEnabled ? 'Mute' : 'Unmute'"
        @click="$emit('toggle-sound')"
      >
        {{ soundEnabled ? '🔊' : '🔇' }}
      </button>
      <button
        class="btn btn-icon"
        :title="theme === 'dark' ? 'Light Mode' : 'Dark Mode'"
        @click="$emit('toggle-theme')"
      >
        {{ theme === 'dark' ? '☀️' : '🌙' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameStatus, Theme } from '../types/game'

defineProps<{
  status: GameStatus
  soundEnabled: boolean
  theme: Theme
  aiEnabled: boolean
}>()

defineEmits<{
  start: []
  restart: []
  'toggle-pause': []
  'toggle-sound': []
  'toggle-theme': []
  'toggle-ai': []
}>()
</script>

<style scoped>
.game-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: bold;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-danger {
  border-color: var(--danger);
  color: var(--danger);
}

.btn-danger:hover {
  background: var(--danger);
  color: #fff;
}

.btn-active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: bold;
}

.btn-icon {
  padding: 10px 14px;
  font-size: 18px;
}

.side-controls {
  display: flex;
  gap: 6px;
}
</style>
