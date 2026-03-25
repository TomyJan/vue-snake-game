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
        :current-speed="baseSpeed"
        @start="onStart"
        @restart="onRestart"
        @end-game="onEndGame"
        @toggle-pause="onTogglePause"
        @toggle-sound="onToggleSound"
        @toggle-theme="onToggleTheme"
        @toggle-ai="onToggleAI"
        @set-speed="onSetSpeed"
      />

      <MobileControls @direction="onDirection" />

      <p class="hint" v-if="state.status === 'idle'">
        Press <kbd>Space</kbd> or <kbd>↑↓←→</kbd> to start
      </p>
      <p class="hint" v-else-if="state.status === 'starting'">
        Get ready...
      </p>
      <p class="hint" v-else-if="state.status === 'playing'">
        <kbd>Space</kbd> pause · <kbd>R</kbd> restart · <kbd>Q</kbd> quit
      </p>
    </main>

    <footer class="controls-help">
      <details>
        <summary>⌨️ Controls</summary>
        <div class="help-grid">
          <div class="help-item"><kbd>↑↓←→</kbd> <kbd>WASD</kbd> Move</div>
          <div class="help-item"><kbd>Space</kbd> Start / Pause</div>
          <div class="help-item"><kbd>R</kbd> Restart</div>
          <div class="help-item"><kbd>Q</kbd> Quit to menu</div>
          <div class="help-item"><kbd>Esc</kbd> Pause</div>
          <div class="help-item">🤖 Toggle AI auto-play</div>
        </div>
      </details>
    </footer>

    <div class="version">
      <a :href="commitUrl" target="_blank" rel="noopener">v{{ version }}+{{ commitShort }}</a>
    </div>

    <GameOverModal
      :show="showGameOverModal"
      :score="state.score"
      :high-score="state.highScore"
      :length="snakeLength"
      :is-new-high-score="isNewHighScore"
      @close="onRestart"
      @restart="onRestart"
      @quit="onQuit"
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
  setSpeed,
  aiEnabled,
  baseSpeed,
  length: snakeLength,
} = useGame()

const { theme, toggleTheme } = useTheme()
const { enabled: soundEnabled, toggleSound, playStart, playEat, playHit } = useSound()

// Version info
const version = __APP_VERSION__
const commitShort = __APP_COMMIT__
const commitUrl = `https://github.com/TomyJan/vue-snake-game/commit/${__APP_COMMIT__}`

const isNewHighScore = computed(() =>
  state.status === 'gameover' && state.score > 0 && state.score >= state.highScore
)

const showGameOverModal = ref(false)
let gameOverTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => state.status, (newStatus, oldStatus) => {
  if (newStatus === 'gameover' && oldStatus === 'playing') {
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

function onEndGame() {
  // Force game over from pause/playing
  showGameOverModal.value = false
  state.status = 'idle'
}

function onQuit() {
  showGameOverModal.value = false
  state.status = 'idle'
}

function onTogglePause() { togglePause() }
function onToggleSound() { toggleSound() }
function onToggleTheme() { toggleTheme() }
function onToggleAI() { toggleAI() }
function onSetSpeed(speed: number) { setSpeed(speed) }

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
  nextTick(() => { appRef.value?.focus() })

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
  if (e.key === 'q' || e.key === 'Q') {
    e.preventDefault()
    onEndGame()
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
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 20px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  overflow: hidden;
}

.header {
  margin-bottom: 8px;
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
  gap: 16px;
  max-width: 100%;
}

.board-wrapper {
  margin: 4px 0;
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

.controls-help {
  margin-top: 20px;
  width: 100%;
  max-width: 500px;
}

.controls-help details {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px 16px;
}

.controls-help summary {
  cursor: pointer;
  font-size: 14px;
  color: var(--text);
  opacity: 0.7;
  user-select: none;
}

.controls-help summary:hover {
  opacity: 1;
}

.help-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}

.help-item {
  font-size: 13px;
  color: var(--text);
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 400px) {
  .help-grid {
    grid-template-columns: 1fr;
  }
}

.version {
  margin-top: 12px;
  font-size: 12px;
  opacity: 0.4;
}

.version a {
  color: var(--text);
  text-decoration: none;
}

.version a:hover {
  color: var(--accent);
  text-decoration: underline;
}

/* Mobile: fullscreen, no scroll */
@media (max-width: 600px) {
  .app {
    padding: 12px 8px 20px;
  }

  .header {
    margin-bottom: 4px;
  }

  .title {
    font-size: 24px;
  }

  .controls-help {
    display: none;
  }

  .version {
    margin-top: 8px;
  }
}
</style>
