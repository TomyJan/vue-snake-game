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

  // === AI ===
  const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right']

  function getNextPosition(pos: Position, dir: Direction): Position {
    const delta = DIRECTION_MAP[dir]
    return { x: pos.x + delta.x, y: pos.y + delta.y }
  }

  function isSafe(pos: Position): boolean {
    if (pos.x < 0 || pos.x >= GAME_CONFIG.gridSize || pos.y < 0 || pos.y >= GAME_CONFIG.gridSize) return false
    if (state.snake.some((seg) => positionsEqual(seg, pos))) return false
    if (state.obstacles.some((o) => positionsEqual(o, pos))) return false
    return true
  }

  // Build a set of occupied positions for fast lookup
  function buildOccupiedSet(extraExclude?: Position): Set<string> {
    const s = new Set<string>()
    for (const seg of state.snake) s.add(`${seg.x},${seg.y}`)
    for (const o of state.obstacles) s.add(`${o.x},${o.y}`)
    if (extraExclude) s.add(`${extraExclude.x},${extraExclude.y}`)
    return s
  }

  // BFS pathfinding, returns full path or null
  function bfs(start: Position, target: Position, occupied?: Set<string>): Position[] | null {
    const occ = occupied || buildOccupiedSet()
    const visited = new Set<string>()
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }]
    visited.add(`${start.x},${start.y}`)

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!
      if (positionsEqual(pos, target)) return path

      for (const dir of ALL_DIRS) {
        const next = getNextPosition(pos, dir)
        const key = `${next.x},${next.y}`
        if (visited.has(key)) continue
        if (next.x < 0 || next.x >= GAME_CONFIG.gridSize || next.y < 0 || next.y >= GAME_CONFIG.gridSize) continue
        if (occ.has(key)) continue
        visited.add(key)
        queue.push({ pos: next, path: [...path, next] })
      }
    }
    return null
  }

  // Count reachable cells from a position
  function countReachable(start: Position, occupied: Set<string>): number {
    const visited = new Set<string>()
    const queue: Position[] = [start]
    visited.add(`${start.x},${start.y}`)

    while (queue.length > 0) {
      const pos = queue.shift()!
      for (const dir of ALL_DIRS) {
        const next = getNextPosition(pos, dir)
        const key = `${next.x},${next.y}`
        if (visited.has(key)) continue
        if (next.x < 0 || next.x >= GAME_CONFIG.gridSize || next.y < 0 || next.y >= GAME_CONFIG.gridSize) continue
        if (occupied.has(key)) continue
        visited.add(key)
        queue.push(next)
      }
    }
    return visited.size
  }

  // Simulate snake after moving to a position (removes tail if not eating)
  function simulateSnakeAfterMove(newHead: Position, willEat: boolean): Position[] {
    const simSnake = [newHead, ...state.snake]
    if (!willEat) simSnake.pop()
    return simSnake
  }

  // Check if snake can reach its own tail after a move
  function canReachTail(newHead: Position, willEat: boolean): boolean {
    const simSnake = simulateSnakeAfterMove(newHead, willEat)
    if (simSnake.length <= 1) return true
    const tail = simSnake[simSnake.length - 1]

    // Build occupied set from simulated snake (excluding tail)
    const occupied = new Set<string>()
    for (let i = 0; i < simSnake.length - 1; i++) {
      occupied.add(`${simSnake[i].x},${simSnake[i].y}`)
    }
    for (const o of state.obstacles) occupied.add(`${o.x},${o.y}`)

    return bfs(newHead, tail, occupied) !== null
  }

  function findSafeDirection(): Direction {
    const currentHead = head.value
    if (!currentHead) return 'right'

    const current = state.direction
    const foodPos = state.food.pos
    const snakeLen = state.snake.length

    // Get safe next moves
    const safeMoves = ALL_DIRS
      .filter(d => d !== OPPOSITE_DIRECTION[current])
      .map(d => ({ dir: d, pos: getNextPosition(currentHead, d) }))
      .filter(m => isSafe(m.pos))

    if (safeMoves.length === 0) {
      // No safe moves, try reverse as last resort
      for (const d of ALL_DIRS) {
        if (isSafe(getNextPosition(currentHead, d))) return d
      }
      return current // will die
    }

    // Strategy 1: Find path to food, verify tail is still reachable after eating
    const occupied = buildOccupiedSet()
    const pathToFood = bfs(currentHead, foodPos, occupied)
    if (pathToFood && pathToFood.length > 0) {
      const nextStep = pathToFood[0]
      const willEat = positionsEqual(nextStep, foodPos)
      if (canReachTail(nextStep, willEat)) {
        // Safe to go for food
        const dir = ALL_DIRS.find(d =>
          positionsEqual(getNextPosition(currentHead, d), nextStep)
        )
        if (dir) return dir
      }
    }

    // Strategy 2: Chase own tail - keeps us alive longest
    if (snakeLen > 1) {
      const tail = state.snake[snakeLen - 1]
      const pathToTail = bfs(currentHead, tail, occupied)
      if (pathToTail && pathToTail.length > 0) {
        const nextStep = pathToTail[0]
        const dir = ALL_DIRS.find(d =>
          positionsEqual(getNextPosition(currentHead, d), nextStep)
        )
        if (dir) return dir
      }
    }

    // Strategy 3: Pick direction with most reachable space
    let bestDir = safeMoves[0].dir
    let bestSpace = 0

    for (const m of safeMoves) {
      const newOccupied = new Set(occupied)
      newOccupied.delete(`${state.snake[snakeLen - 1].x},${state.snake[snakeLen - 1].y}`)
      newOccupied.add(`${m.pos.x},${m.pos.y}`)
      const space = countReachable(m.pos, newOccupied)
      if (space > bestSpace) {
        bestSpace = space
        bestDir = m.dir
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
