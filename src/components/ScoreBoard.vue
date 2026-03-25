<template>
  <div class="score-board">
    <div class="score-item">
      <span class="score-label">SCORE</span>
      <span class="score-value">{{ score }}</span>
    </div>
    <div class="score-item best">
      <span class="score-label">BEST</span>
      <span class="score-value">{{ highScore }}</span>
    </div>
    <div class="score-item length">
      <span class="score-label">LENGTH</span>
      <span class="score-value">{{ length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  score: number
  highScore: number
  length: number
}>()
</script>

<style scoped>
.score-board {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 20px;
  min-width: 80px;
}

.score-item.best .score-value {
  color: var(--accent);
}

.score-label {
  font-size: 11px;
  color: var(--text);
  opacity: 0.6;
  letter-spacing: 2px;
}

.score-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text);
  font-family: 'Courier New', monospace;
}
</style>
