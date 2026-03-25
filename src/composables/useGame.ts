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

  // === AI - Hamiltonian Cycle with Shortcuts ===
  const DIR_PRIORITY: Direction[] = ['up', 'right', 'down', 'left']
  let hamiltonianCycle: Position[] = []
  let cycleIndex: Map<string, number> = new Map()

  function posKey(p: Position): string { return `${p.x},${p.y}` }

  function nextPos(pos: Position, dir: Direction): Position {
    const d = DIRECTION_MAP[dir]
    return { x: pos.x + d.x, y: pos.y + d.y }
  }

  function isInBounds(p: Position): boolean {
    return p.x >= 0 && p.x < GAME_CONFIG.gridSize && p.y >= 0 && p.y < GAME_CONFIG.gridSize
  }

  // Build a Hamiltonian cycle using zigzag pattern
  // For even-sized grids, this guarantees a cycle covering every cell
  function buildHamiltonianCycle(): void {
    const n = GAME_CONFIG.gridSize
    const cycle: Position[] = []

    // Zigzag: row 0 left→right, row 1 right→left, etc.
    for (let y = 0; y < n; y++) {
      if (y % 2 === 0) {
        for (let x = 0; x < n; x++) cycle.push({ x, y })
      } else {
        for (let x = n - 1; x >= 0; x--) cycle.push({ x, y })
      }
    }

    // For odd grids, zigzag doesn't connect end→start.
    // Use a modified pattern that connects vertically at edges.
    if (n % 2 !== 0) {
      // Rebuild with column-first zigzag for odd grids
      cycle.length = 0
      for (let x = 0; x < n; x++) {
        if (x % 2 === 0) {
          for (let y = 0; y < n; y++) cycle.push({ x, y })
        } else {
          for (let y = n - 1; y >= 0; y--) cycle.push({ x, y })
        }
      }
    }

    hamiltonianCycle = cycle
    cycleIndex = new Map()
    for (let i = 0; i < cycle.length; i++) {
      cycleIndex.set(posKey(cycle[i]), i)
    }
  }

  // Get next position on the cycle
  function cycleNext(pos: Position): Position {
    const idx = cycleIndex.get(posKey(pos))
    if (idx === undefined) return pos
    return hamiltonianCycle[(idx + 1) % hamiltonianCycle.length]
  }

  function buildOccupied(): Set<string> {
    const s = new Set<string>()
    for (let i = 0; i < state.snake.length; i++) s.add(posKey(state.snake[i]))
    for (const o of state.obstacles) s.add(posKey(o))
    return s
  }

  function bfsPath(start: Position, target: Position, occupied: Set<string>): Direction | null {
    const visited = new Set<string>()
    const queue: { pos: Position; firstDir: Direction }[] = []
    visited.add(posKey(start))

    for (const dir of DIR_PRIORITY) {
      const n = nextPos(start, dir)
      const k = posKey(n)
      if (isInBounds(n) && !occupied.has(k)) {
        visited.add(k)
        if (positionsEqual(n, target)) return dir
        queue.push({ pos: n, firstDir: dir })
      }
    }

    while (queue.length > 0) {
      const { pos, firstDir } = queue.shift()!
      for (const dir of DIR_PRIORITY) {
        const n = nextPos(pos, dir)
        const k = posKey(n)
        if (visited.has(k) || !isInBounds(n) || occupied.has(k)) continue
        visited.add(k)
        if (positionsEqual(n, target)) return firstDir
        queue.push({ pos: n, firstDir })
      }
    }
    return null
  }

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

  function dirBetween(from: Position, to: Position): Direction | null {
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
    if (hamiltonianCycle.length === 0) buildHamiltonianCycle()

    const headKey = posKey(headPos)
    const foodPos = state.food.pos
    const occupied = buildOccupied()
    const snakeLen = state.snake.length

    // 1. Try shortcut to food: BFS path + safety check
    const foodDir = bfsPath(headPos, foodPos, occupied)
    if (foodDir) {
      const foodNext = nextPos(headPos, foodDir)
      // After eating: snake grows, tail stays
      const newOccupied = new Set(occupied)
      newOccupied.add(posKey(foodNext))
      const space = floodFill(foodNext, newOccupied)
      if (space > snakeLen + 5) {
        return foodDir
      }
    }

    // 2. Follow Hamiltonian cycle
    const nextOnCycle = cycleNext(headPos)
    const nextKey = posKey(nextOnCycle)
    if (!occupied.has(nextKey) && isInBounds(nextOnCycle)) {
      return dirBetween(headPos, nextOnCycle) ?? 'right'
    }

    // 3. Cycle blocked: BFS to next free cell on cycle
    // Find the nearest unoccupied cell ahead on the cycle
    const cycleLen = hamiltonianCycle.length
    const startIdx = cycleIndex.get(headKey) ?? 0
    for (let offset = 1; offset < cycleLen; offset++) {
      const targetIdx = (startIdx + offset) % cycleLen
      const target = hamiltonianCycle[targetIdx]
      if (!occupied.has(posKey(target)) && isInBounds(target)) {
        const dir = bfsPath(headPos, target, occupied)
        if (dir) return dir
      }
    }

    // 4. Emergency: any safe direction
    for (const dir of DIR_PRIORITY) {
      const n = nextPos(headPos, dir)
      if (isInBounds(n) && !occupied.has(posKey(n))) return dir
    }

    return 'right'
  }

  // Initialize cycle
  buildHamiltonianCycle()

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
