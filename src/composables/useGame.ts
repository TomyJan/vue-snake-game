import { ref, reactive, computed, onUnmounted } from 'vue'
import type { GameState, Direction, Position } from '../types/game'
import { GAME_CONFIG, DIRECTION_MAP, OPPOSITE_DIRECTION, KEY_DIRECTION_MAP } from '../utils/constants'
import { randomPosition, positionsEqual, clampSpeed } from '../utils/helpers'

const HIGH_SCORE_KEY = 'snake-high-score'
const START_DELAY_MS = 800 // Delay before snake starts moving after start/restart

export function useGame() {
  const highScore = ref(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0)
  const countdown = ref(0)

  const state = reactive<GameState>({
    snake: [],
    food: { x: 0, y: 0 },
    direction: 'right',
    nextDirection: 'right',
    score: 0,
    highScore: highScore.value,
    status: 'idle',
    speed: GAME_CONFIG.initialSpeed,
  })

  let gameTimer: ReturnType<typeof setInterval> | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let aiEnabled = ref(false)
  let aiInterval: ReturnType<typeof setInterval> | null = null

  const head = computed(() => state.snake[0])
  const tail = computed(() => state.snake[state.snake.length - 1])
  const length = computed(() => state.snake.length)

  function initSnake(): Position[] {
    const startX = Math.floor(GAME_CONFIG.gridSize / 2)
    const startY = Math.floor(GAME_CONFIG.gridSize / 2)
    const snake: Position[] = []
    for (let i = 0; i < GAME_CONFIG.initialLength; i++) {
      snake.push({ x: startX - i, y: startY })
    }
    return snake
  }

  function spawnFood(): Position {
    return randomPosition(GAME_CONFIG.gridSize, state.snake)
  }

  function startGame() {
    clearTimers()
    state.snake = initSnake()
    state.food = spawnFood()
    state.direction = 'right'
    state.nextDirection = 'right'
    state.score = 0
    state.speed = GAME_CONFIG.initialSpeed
    state.status = 'starting'

    // Delay before snake starts moving
    startTimer = setTimeout(() => {
      if (state.status === 'starting') {
        state.status = 'playing'
        startGameTimer()
        if (aiEnabled.value) startAI()
      }
    }, START_DELAY_MS)
  }

  function pauseGame() {
    if (state.status === 'playing') {
      state.status = 'paused'
      stopGameTimer()
      stopAI()
    }
  }

  function resumeGame() {
    if (state.status === 'paused') {
      state.status = 'playing'
      startGameTimer()
      if (aiEnabled.value) startAI()
    }
  }

  function togglePause() {
    if (state.status === 'playing') pauseGame()
    else if (state.status === 'paused') resumeGame()
  }

  function gameOver() {
    state.status = 'gameover'
    clearTimers()
    stopAI()
    if (state.score > highScore.value) {
      highScore.value = state.score
      localStorage.setItem(HIGH_SCORE_KEY, String(state.score))
      state.highScore = state.score
    }
  }

  function moveSnake(): { hit?: boolean; ate?: boolean } {
    state.direction = state.nextDirection
    const delta = DIRECTION_MAP[state.direction]
    const newHead: Position = {
      x: head.value.x + delta.x,
      y: head.value.y + delta.y,
    }

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= GAME_CONFIG.gridSize ||
      newHead.y < 0 ||
      newHead.y >= GAME_CONFIG.gridSize
    ) {
      gameOver()
      return { hit: true }
    }

    // Self collision
    if (state.snake.some((seg) => positionsEqual(seg, newHead))) {
      gameOver()
      return { hit: true }
    }

    // Check food
    const ate = positionsEqual(newHead, state.food)
    state.snake.unshift(newHead)

    if (ate) {
      state.score += 10
      state.speed = clampSpeed(state.score, GAME_CONFIG)
      state.food = spawnFood()
      restartGameTimer()
      return { ate: true }
    } else {
      state.snake.pop()
      return { ate: false }
    }
  }

  function startGameTimer() {
    stopGameTimer()
    gameTimer = setInterval(() => {
      moveSnake()
    }, state.speed)
  }

  function stopGameTimer() {
    if (gameTimer) {
      clearInterval(gameTimer)
      gameTimer = null
    }
  }

  function restartGameTimer() {
    if (state.status === 'playing') {
      startGameTimer()
    }
  }

  function clearTimers() {
    stopGameTimer()
    if (startTimer) {
      clearTimeout(startTimer)
      startTimer = null
    }
  }

  function setDirection(dir: Direction) {
    if (OPPOSITE_DIRECTION[dir] !== state.direction) {
      state.nextDirection = dir
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const dir = KEY_DIRECTION_MAP[e.key]
    if (dir) {
      e.preventDefault()
      setDirection(dir)
    }
    if (e.key === ' ' || e.key === 'Escape') {
      e.preventDefault()
      if (state.status === 'idle') startGame()
      else if (state.status === 'playing' || state.status === 'paused') togglePause()
    }
  }

  // === AI Logic ===
  function getNextPosition(pos: Position, dir: Direction): Position {
    const delta = DIRECTION_MAP[dir]
    return { x: pos.x + delta.x, y: pos.y + delta.y }
  }

  function isSafe(pos: Position): boolean {
    if (pos.x < 0 || pos.x >= GAME_CONFIG.gridSize || pos.y < 0 || pos.y >= GAME_CONFIG.gridSize) return false
    if (state.snake.some((seg) => positionsEqual(seg, pos))) return false
    return true
  }

  function bfs(start: Position, target: Position): Direction | null {
    const visited = new Set<string>()
    const queue: { pos: Position; path: Direction[] }[] = [{ pos: start, path: [] }]
    visited.add(`${start.x},${start.y}`)

    const dirs: Direction[] = ['up', 'down', 'left', 'right']

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!

      if (positionsEqual(pos, target)) {
        return path[0] || null
      }

      for (const dir of dirs) {
        const next = getNextPosition(pos, dir)
        const key = `${next.x},${next.y}`
        if (!visited.has(key) && isSafe(next)) {
          visited.add(key)
          queue.push({ pos: next, path: [...path, dir] })
        }
      }
    }
    return null
  }

  function findSafeDirection(): Direction {
    const dirs: Direction[] = ['up', 'down', 'left', 'right']
    const current = state.direction

    // Try to go towards food via BFS
    if (head.value && state.food) {
      const foodDir = bfs(head.value, state.food)
      if (foodDir && isSafe(getNextPosition(head.value, foodDir))) {
        return foodDir
      }
    }

    // Try current direction
    if (isSafe(getNextPosition(head.value, current))) return current

    // Try any safe direction, preferring non-reverse
    for (const dir of dirs) {
      if (dir !== OPPOSITE_DIRECTION[current] && isSafe(getNextPosition(head.value, dir))) {
        return dir
      }
    }

    // Last resort
    for (const dir of dirs) {
      if (isSafe(getNextPosition(head.value, dir))) return dir
    }

    return current // will die
  }

  function aiTick() {
    if (state.status !== 'playing') return
    const dir = findSafeDirection()
    setDirection(dir)
  }

  function startAI() {
    stopAI()
    aiEnabled.value = true
    aiInterval = setInterval(aiTick, 30) // AI thinks faster than snake moves
  }

  function stopAI() {
    if (aiInterval) {
      clearInterval(aiInterval)
      aiInterval = null
    }
  }

  function toggleAI() {
    aiEnabled.value = !aiEnabled.value
    if (aiEnabled.value && state.status === 'playing') {
      startAI()
    } else {
      stopAI()
    }
  }

  onUnmounted(() => {
    clearTimers()
    stopAI()
  })

  return {
    state,
    countdown,
    head,
    tail,
    length,
    aiEnabled,
    startGame,
    pauseGame,
    resumeGame,
    togglePause,
    setDirection,
    handleKeydown,
    moveSnake,
    toggleAI,
  }
}
