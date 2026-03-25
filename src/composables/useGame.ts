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

  // === AI - Greedy Solver with Tail Safety ===
  const DIR_PRIORITY: Direction[] = ['up', 'right', 'down', 'left']

  function nextPos(pos: Position, dir: Direction): Position {
    const d = DIRECTION_MAP[dir]
    return { x: pos.x + d.x, y: pos.y + d.y }
  }

  function posKey(p: Position): string { return `${p.x},${p.y}` }

  function isFree(p: Position, occupied: Set<string>): boolean {
    if (p.x < 0 || p.x >= GAME_CONFIG.gridSize || p.y < 0 || p.y >= GAME_CONFIG.gridSize) return false
    return !occupied.has(posKey(p))
  }

  function buildOccupied(): Set<string> {
    const s = new Set<string>()
    for (let i = 0; i < state.snake.length - 1; i++) s.add(posKey(state.snake[i]))
    for (const o of state.obstacles) s.add(posKey(o))
    return s
  }

  // BFS shortest path, returns array of positions (excluding start)
  function bfsPath(start: Position, target: Position, occupied: Set<string>): Position[] | null {
    const visited = new Set<string>()
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }]
    visited.add(posKey(start))

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!
      if (positionsEqual(pos, target)) return path

      for (const dir of DIR_PRIORITY) {
        const n = nextPos(pos, dir)
        const k = posKey(n)
        if (visited.has(k) || !isFree(n, occupied)) continue
        visited.add(k)
        queue.push({ pos: n, path: [...path, n] })
      }
    }
    return null
  }

  // BFS longest-ish path (heuristic: prefer far cells, extend greedily)
  function bfsFarthest(start: Position, occupied: Set<string>): Position[] | null {
    const visited = new Set<string>()
    let bestPath: Position[] = []
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }]
    visited.add(posKey(start))

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!
      if (path.length > bestPath.length) bestPath = path

      for (const dir of DIR_PRIORITY) {
        const n = nextPos(pos, dir)
        const k = posKey(n)
        if (visited.has(k) || !isFree(n, occupied)) continue
        visited.add(k)
        queue.push({ pos: n, path: [...path, n] })
      }
    }
    return bestPath.length > 0 ? bestPath : null
  }

  // Simulate snake after eating along a path
  function simulateAfterPath(path: Position[]): { head: Position; occupied: Set<string> } | null {
    if (path.length === 0) return null
    const newHead = path[path.length - 1]
    // Snake grows: new head added, old tail NOT removed
    const newOccupied = new Set<string>()
    for (const seg of state.snake) newOccupied.add(posKey(seg))
    for (const o of state.obstacles) newOccupied.add(posKey(o))
    newOccupied.add(posKey(newHead))
    return { head: newHead, occupied: newOccupied }
  }

  function dirOf(from: Position, to: Position): Direction | null {
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (dx === 1 && dy === 0) return 'right'
    if (dx === -1 && dy === 0) return 'left'
    if (dx === 0 && dy === 1) return 'down'
    if (dx === 0 && dy === -1) return 'up'
    return null
  }

  function findSafeDirection(): Direction {
    const headPos = head.value
    if (!headPos) return 'right'

    const occupied = buildOccupied()
    const foodPos = state.food.pos

    // 1. Try shortest path to food
    const foodPath = bfsPath(headPos, foodPos, occupied)
    if (foodPath && foodPath.length > 0) {
      // Simulate: after eating, can we still reach tail?
      const sim = simulateAfterPath(foodPath)
      if (sim) {
        // Add old tail back (it will be removed on next move since snake didn't grow yet)
        // Actually: after eating, snake grows by 1. So tail stays.
        // We need to check if there's ANY path from new head to the tail
        const tailPos = state.snake[state.snake.length - 1]
        // Remove old tail from occupied since next move will pop it
        sim.occupied.delete(posKey(tailPos))
        const pathToTail = bfsPath(sim.head, tailPos, sim.occupied)
        if (pathToTail) {
          const d = dirOf(headPos, foodPath[0])
          if (d) return d
        }
      }
    }

    // 2. No safe food path: find farthest reachable space (stay alive)
    const farPath = bfsFarthest(headPos, occupied)
    if (farPath && farPath.length > 0) {
      const d = dirOf(headPos, farPath[0])
      if (d) return d
    }

    // 3. Last resort: any safe direction
    for (const dir of DIR_PRIORITY) {
      const n = nextPos(headPos, dir)
      if (isFree(n, occupied)) return dir
    }

    return state.direction // will die
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
