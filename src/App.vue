<template>
  <div class="app" @keydown="handleKeydown" tabindex="0" ref="appRef">
    <header class="header">
      <h1 class="title">🐍 Snake</h1>
    </header>

    <main class="main">
      <ScoreBoard
        :score="state.score"
        :high-score="state.highScore"
        :length="snakeLength"
      />

      <div class="board-wrapper">
        <GameBoard
          :snake="state.snake"
          :food="state.food"
          :status="state.status"
        />
      </div>

      <GameControls
        :status="state.status"
        :sound-enabled="soundEnabled"
        :theme="theme"
        :ai-enabled="aiEnabled"
        @start="onStart"
        @restart="onRestart"
        @toggle-pause="onTogglePause"
        @toggle-sound="onToggleSound"
        @toggle-theme="onToggleTheme"
        @toggle-ai="onToggleAI"
      />

      <MobileControls @direction="onDirection" />

      <p class="hint" v-if="state.status === 'idle'">
        Press <kbd>Space</kbd> or <kbd>↑↓←→</kbd> to start
      </p>
      <p class="hint" v-else-if="state.status === 'starting'">
        Get ready...
      </p>
      <p class="hint" v-else-if="state.status === 'playing'">
        <kbd>Space</kbd> pause · <kbd>R</kbd> restart
      </p>
    </main>

    <GameOverModal
      :show="showGameOverModal"
      :score="state.score"
      :high-score="state.highScore"
      :length="snakeLength"
      :is-new-high-score="isNewHighScore"
      @close="onRestart"
      @restart="onRestart"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import GameBoard from './components/GameBoard.vue'
import ScoreBoard from './components/ScoreBoard.vue'
import GameControls from './components/GameControls.vue'
import GameOverModal from './components/GameOverModal.vue'
import MobileControls from './components/MobileControls.vue'
import { useGame } from './composables/useGame'
import { useTheme } from './composables/useTheme'
import { useSound } from './composables/useSound'
import type { Direction } from './types/game'

const appRef = ref<HTMLElement | null>(null)
const {
  state,
  startGame,
  togglePause,
  setDirection,
  handleKeydown,
  toggleAI,
  aiEnabled,
  length: snakeLength,
} = useGame()

const { theme, toggleTheme } = useTheme()
const { enabled: soundEnabled, toggleSound, playStart, playEat, playHit } = useSound()

const isNewHighScore = computed(() =>
  state.status === 'gameover' && state.score > 0 && state.score >= state.highScore
)

// Delay modal appearance to prevent flash on quick restart
const showGameOverModal = ref(false)
let gameOverTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => state.status, (newStatus, oldStatus) => {
  if (newStatus === 'gameover' && oldStatus === 'playing') {
    // Show modal after a short delay
    gameOverTimeout = setTimeout(() => {
      showGameOverModal.value = true
    }, 100)
  } else if (newStatus !== 'gameover') {
    showGameOverModal.value = false
    if (gameOverTimeout) {
      clearTimeout(gameOverTimeout)
      gameOverTimeout = null
    }
  }
})

function onStart() {
  playStart()
  startGame()
}

function onRestart() {
  showGameOverModal.value = false
  playStart()
  startGame()
}

function onTogglePause() {
  togglePause()
}

function onToggleSound() {
  toggleSound()
}

function onToggleTheme() {
  toggleTheme()
}

function onToggleAI() {
  toggleAI()
}

function onDirection(dir: Direction) {
  if (state.status === 'idle' || state.status === 'starting') {
    playStart()
    if (state.status === 'idle') startGame()
  }
  setDirection(dir)
}

// Sound events
let prevLength = 3
let prevStatus = 'idle'

onMounted(() => {
  nextTick(() => {
    appRef.value?.focus()
  })

  setInterval(() => {
    if (state.snake.length > prevLength) {
      playEat()
      prevLength = state.snake.length
    } else {
      prevLength = state.snake.length
    }
    if (state.status === 'gameover' && prevStatus === 'playing') {
      playHit()
    }
    prevStatus = state.status
  }, 50)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault()
    onRestart()
    return
  }
  handleKeydown(e)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  background: var(--bg);
  color: var(--text);
  outline: none;
}

.header {
  margin-bottom: 20px;
}

.title {
  font-size: 32px;
  margin: 0;
  color: var(--accent);
  text-align: center;
}

.main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 100%;
}

.board-wrapper {
  margin: 8px 0;
}

.hint {
  font-size: 13px;
  color: var(--text);
  opacity: 0.5;
  text-align: center;
}

kbd {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}
</style>
