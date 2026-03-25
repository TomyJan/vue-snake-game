import { ref, reactive, computed, onUnmounted } from 'vue'
import type { GameState, Direction, Position } from '../types/game'
import { GAME_CONFIG, DIRECTION_MAP, OPPOSITE_DIRECTION, KEY_DIRECTION_MAP } from '../utils/constants'
import { randomPosition, positionsEqual, clampSpeed } from '../utils/helpers'

const HIGH_SCORE_KEY = 'snake-high-score'

export function useGame() {
  const highScore = ref(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0)

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
    state.snake = initSnake()
    state.food = spawnFood()
    state.direction = 'right'
    state.nextDirection = 'right'
    state.score = 0
    state.status = 'playing'
    state.speed = GAME_CONFIG.initialSpeed
    startTimer()
  }

  function pauseGame() {
    if (state.status === 'playing') {
      state.status = 'paused'
      stopTimer()
    }
  }

  function resumeGame() {
    if (state.status === 'paused') {
      state.status = 'playing'
      startTimer()
    }
  }

  function togglePause() {
    if (state.status === 'playing') pauseGame()
    else if (state.status === 'paused') resumeGame()
  }

  function gameOver() {
    state.status = 'gameover'
    stopTimer()
    if (state.score > highScore.value) {
      highScore.value = state.score
      localStorage.setItem(HIGH_SCORE_KEY, String(state.score))
      state.highScore = state.score
    }
  }

  function moveSnake() {
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
      restartTimer()
      return { ate: true }
    } else {
      state.snake.pop()
      return { ate: false }
    }
  }

  function startTimer() {
    stopTimer()
    gameTimer = setInterval(() => {
      moveSnake()
    }, state.speed)
  }

  function stopTimer() {
    if (gameTimer) {
      clearInterval(gameTimer)
      gameTimer = null
    }
  }

  function restartTimer() {
    if (state.status === 'playing') {
      startTimer()
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

  onUnmounted(() => {
    stopTimer()
  })

  return {
    state,
    head,
    tail,
    length,
    startGame,
    pauseGame,
    resumeGame,
    togglePause,
    setDirection,
    handleKeydown,
    moveSnake,
  }
}
