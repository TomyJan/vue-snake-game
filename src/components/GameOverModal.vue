<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal">
          <h2 class="modal-title">💀 Game Over</h2>
          <div class="modal-body">
            <div class="final-score">
              <span class="label">Final Score</span>
              <span class="value">{{ score }}</span>
            </div>
            <div v-if="isNewHighScore" class="new-best">
              🎉 New High Score!
            </div>
            <div class="stats">
              <div class="stat">
                <span>Snake Length</span>
                <span>{{ length }}</span>
              </div>
              <div class="stat">
                <span>Best Score</span>
                <span>{{ highScore }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" @click="$emit('restart')">
              ↻ Play Again
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  score: number
  highScore: number
  length: number
  isNewHighScore: boolean
}>()

defineEmits<{
  close: []
  restart: []
}>()
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 32px;
  min-width: 300px;
  text-align: center;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.4);
}

.modal-title {
  margin: 0 0 20px;
  font-size: 28px;
  color: var(--danger);
}

.modal-body {
  margin-bottom: 24px;
}

.final-score {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.final-score .label {
  font-size: 12px;
  color: var(--text);
  opacity: 0.6;
  letter-spacing: 2px;
}

.final-score .value {
  font-size: 48px;
  font-weight: bold;
  color: var(--accent);
  font-family: 'Courier New', monospace;
}

.new-best {
  margin-top: 8px;
  font-size: 18px;
  color: var(--accent);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.stats {
  margin-top: 20px;
  display: flex;
  gap: 24px;
  justify-content: center;
}

.stat {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  color: var(--text);
  opacity: 0.8;
}

.stat span:last-child {
  font-weight: bold;
  font-size: 18px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 12px 28px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
