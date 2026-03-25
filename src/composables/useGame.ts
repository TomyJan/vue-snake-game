import { ref, reactive, computed, onUnmounted } from 'vue'
import type { GameState, Direction, Position, Food } from '../types/game'
import { GAME_CONFIG, DIRECTION_MAP, OPPOSITE_DIRECTION, KEY_DIRECTION_MAP, OBSTACLE_COUNT } from '../utils/constants'
import { positionsEqual, spawnFood, generateObstacles } from '../utils/helpers'

const HIGH_SCORE_KEY = 'snake-high-score'
const START_DELAY_MS = 800
const SLOW_BUFF_DURATION = 5000

export function useGame() {
  const highScore = ref(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0)
  const baseSpeed = ref(GAME_CONFIG.initialSpeed)

  const emptyFood: Food = { pos: { x: 0, y: 0 }, type: 'normal' }

  const state = reactive<GameState>({
    snake: [],
    food: emptyFood,
    obstacles: [],
    direction: 'right',
    nextDirection: 'right',
    score: 0,
    highScore: highScore.value,
    status: 'idle',
    speed: GAME_CONFIG.initialSpeed,
    particles: [],
  })

  let gameTimer: ReturnType<typeof setInterval> | null = null
  let startDelayTimer: ReturnType<typeof setTimeout> | null = null
  let slowBuffTimer: ReturnType<typeof setTimeout> | null = null
  let particleTimer: ReturnType<typeof setInterval> | null = null
  const aiEnabled = ref(false)
  let aiInterval: ReturnType<typeof setInterval> | null = null

  const head = computed(() => state.snake[0])
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

  function startGame() {
    clearTimers()
    state.snake = initSnake()
    state.obstacles = generateObstacles(GAME_CONFIG.gridSize, state.snake, { x: 0, y: 0 }, OBSTACLE_COUNT)
    state.food = spawnFood(GAME_CONFIG.gridSize, state.snake, state.obstacles)
    state.direction = 'right'
    state.nextDirection = 'right'
    state.score = 0
    state.speed = baseSpeed.value
    state.particles = []
    state.status = 'starting'

    startDelayTimer = setTimeout(() => {
      if (state.status === 'starting') {
        state.status = 'playing'
        startGameTimer()
        startParticleTimer()
        if (aiEnabled.value) startAI()
      }
    }, START_DELAY_MS)
  }

  function endGame() {
    clearTimers()
    stopAI()
    state.status = 'idle'
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

  function emitParticles(x: number, y: number, color: string, count: number = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const speed = 2 + Math.random() * 3
      state.particles.push({
        x: x * GAME_CONFIG.cellSize + GAME_CONFIG.cellSize / 2,
        y: y * GAME_CONFIG.cellSize + GAME_CONFIG.cellSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 3 + Math.random() * 3,
      })
    }
  }

  function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.04
      p.vx *= 0.96
      p.vy *= 0.96
      if (p.life <= 0) state.particles.splice(i, 1)
    }
  }

  function applySlowBuff() {
    // Temporary speed reduction
    state.speed = Math.min(baseSpeed.value + 60, 350)
    restartGameTimer()
    if (slowBuffTimer) clearTimeout(slowBuffTimer)
    slowBuffTimer = setTimeout(() => {
      // Revert to base speed
      state.speed = baseSpeed.value
      if (state.status === 'playing') restartGameTimer()
    }, SLOW_BUFF_DURATION)
  }

  function moveSnake(): { hit?: boolean; ate?: boolean } {
    state.direction = state.nextDirection
    const delta = DIRECTION_MAP[state.direction]
    const newHead: Position = {
      x: head.value.x + delta.x,
      y: head.value.y + delta.y,
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GAME_CONFIG.gridSize || newHead.y < 0 || newHead.y >= GAME_CONFIG.gridSize) {
      gameOver()
      return { hit: true }
    }

    // Self collision
    if (state.snake.some((seg) => positionsEqual(seg, newHead))) {
      gameOver()
      return { hit: true }
    }

    // Obstacle collision
    if (state.obstacles.some((o) => positionsEqual(o, newHead))) {
      gameOver()
      return { hit: true }
    }

    // Check bonus food expiry
    if (state.food.expiresAt && Date.now() > state.food.expiresAt) {
      state.food = spawnFood(GAME_CONFIG.gridSize, state.snake, state.obstacles)
    }

    // Check food
    const ate = positionsEqual(newHead, state.food.pos)
    state.snake.unshift(newHead)

    if (ate) {
      let points = 10
      let color = '#ff4444'
      let particleCount = 8

      if (state.food.type === 'bonus') {
        points = 30
        color = '#ffd700'
        particleCount = 16
      } else if (state.food.type === 'slow') {
        color = '#4488ff'
        applySlowBuff()
      }

      state.score += points
      emitParticles(state.food.pos.x, state.food.pos.y, color, particleCount)
      state.food = spawnFood(GAME_CONFIG.gridSize, state.snake, state.obstacles)
      return { ate: true }
    } else {
      state.snake.pop()
      return { ate: false }
    }
  }

  function startGameTimer() {
    stopGameTimer()
    gameTimer = setInterval(() => { moveSnake() }, state.speed)
  }

  function stopGameTimer() {
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null }
  }

  function restartGameTimer() {
    if (state.status === 'playing') startGameTimer()
  }

  function startParticleTimer() {
    stopParticleTimer()
    particleTimer = setInterval(updateParticles, 16)
  }

  function stopParticleTimer() {
    if (particleTimer) { clearInterval(particleTimer); particleTimer = null }
  }

  function clearTimers() {
    stopGameTimer()
    stopParticleTimer()
    if (startDelayTimer) { clearTimeout(startDelayTimer); startDelayTimer = null }
    if (slowBuffTimer) { clearTimeout(slowBuffTimer); slowBuffTimer = null }
  }

  function setDirection(dir: Direction) {
    if (OPPOSITE_DIRECTION[dir] !== state.direction) {
      state.nextDirection = dir
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const dir = KEY_DIRECTION_MAP[e.key]
    if (dir) { e.preventDefault(); setDirection(dir) }
    if (e.key === ' ' || e.key === 'Escape') {
      e.preventDefault()
      if (state.status === 'idle') startGame()
      else if (state.status === 'playing' || state.status === 'paused') togglePause()
    }
  }

  // === AI - Greedy Flood Fill Solver ===
  const DIR_PRIORITY: Direction[] = ['up', 'right', 'down', 'left']

  function nextPos(pos: Position, dir: Direction): Position {
    const d = DIRECTION_MAP[dir]
    return { x: pos.x + d.x, y: pos.y + d.y }
  }

  function posKey(p: Position): string { return `${p.x},${p.y}` }

  function buildOccupied(): Set<string> {
    const s = new Set<string>()
    for (let i = 0; i < state.snake.length - 1; i++) s.add(posKey(state.snake[i]))
    for (const o of state.obstacles) s.add(posKey(o))
    return s
  }

  function isInBounds(p: Position): boolean {
    return p.x >= 0 && p.x < GAME_CONFIG.gridSize && p.y >= 0 && p.y < GAME_CONFIG.gridSize
  }

  // BFS shortest path, returns first step direction or null
  function bfsFirstStep(start: Position, target: Position, occupied: Set<string>): Direction | null {
    const visited = new Set<string>()
    const queue: { pos: Position; firstDir: Direction }[] = []
    visited.add(posKey(start))

    for (const dir of DIR_PRIORITY) {
      const n = nextPos(start, dir)
      const k = posKey(n)
      if (isInBounds(n) && !occupied.has(k)) {
        visited.add(k)
        queue.push({ pos: n, firstDir: dir })
      }
    }

    while (queue.length > 0) {
      const { pos, firstDir } = queue.shift()!
      if (positionsEqual(pos, target)) return firstDir

      for (const dir of DIR_PRIORITY) {
        const n = nextPos(pos, dir)
        const k = posKey(n)
        if (visited.has(k) || !isInBounds(n) || occupied.has(k)) continue
        visited.add(k)
        queue.push({ pos: n, firstDir })
      }
    }
    return null
  }

  // Flood fill: count reachable cells from start
  function floodFill(start: Position, occupied: Set<string>): number {
    const visited = new Set<string>()
    const queue: Position[] = [start]
    visited.add(posKey(start))

    while (queue.length > 0) {
      const pos = queue.shift()!
      for (const dir of DIR_PRIORITY) {
        const n = nextPos(pos, dir)
        const k = posKey(n)
        if (visited.has(k) || !isInBounds(n) || occupied.has(k)) continue
        visited.add(k)
        queue.push(n)
      }
    }
    return visited.size
  }

  function findSafeDirection(): Direction {
    const headPos = head.value
    if (!headPos) return 'right'

    const occupied = buildOccupied()
    const foodPos = state.food.pos
    const snakeLen = state.snake.length

    // Get valid next moves
    const validMoves = DIR_PRIORITY
      .filter(d => {
        const n = nextPos(headPos, d)
        return isInBounds(n) && !occupied.has(posKey(n))
      })

    if (validMoves.length === 0) return state.direction

    // Strategy 1: Go to food if flood fill after eating > snake length (safe margin)
    const foodDir = bfsFirstStep(headPos, foodPos, occupied)
    if (foodDir) {
      const foodNext = nextPos(headPos, foodDir)
      // Simulate: new head at foodNext, snake grows by 1
      const newOccupied = new Set(occupied)
      newOccupied.add(posKey(foodNext))
      // Snake grows so tail stays - but on NEXT move tail will be removed
      // So check flood fill without removing tail (conservative)
      const space = floodFill(foodNext, newOccupied)
      if (space > snakeLen * 1.5) {
        return foodDir
      }
    }

    // Strategy 2: Maximize reachable space (stay alive)
    let bestDir = validMoves[0]
    let bestSpace = 0

    for (const dir of validMoves) {
      const n = nextPos(headPos, dir)
      // Simulate: move there, tail gets removed
      const newOccupied = new Set(occupied)
      const tailPos = state.snake[snakeLen - 1]
      newOccupied.delete(posKey(tailPos))
      newOccupied.add(posKey(n))
      const space = floodFill(n, newOccupied)
      if (space > bestSpace) {
        bestSpace = space
        bestDir = dir
      }
    }

    return bestDir
  }

  function aiTick() {
    if (state.status !== 'playing') return
    setDirection(findSafeDirection())
  }

  function startAI() {
    stopAI()
    aiEnabled.value = true
    aiInterval = setInterval(aiTick, 30)
  }

  function stopAI() {
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null }
  }

  function toggleAI() {
    aiEnabled.value = !aiEnabled.value
    if (aiEnabled.value && state.status === 'playing') startAI()
    else stopAI()
  }

  function setSpeed(speed: number) {
    baseSpeed.value = speed
    if (state.status === 'idle') state.speed = speed
  }

  onUnmounted(() => { clearTimers(); stopAI() })

  return {
    state, head, length, aiEnabled, baseSpeed,
    startGame, endGame, pauseGame, resumeGame, togglePause,
    setDirection, handleKeydown, moveSnake,
    toggleAI, setSpeed,
  }
}
