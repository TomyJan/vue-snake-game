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

  // === AI - Hamiltonian Cycle + Greedy Shortcuts ===
  const DIRS: Direction[] = ['up', 'right', 'down', 'left']
  let cycle: Position[] = []       // Hamiltonian cycle cells in order
  let cycleIdx: Map<string, number> = new Map()

  function pk(p: Position): string { return `${p.x},${p.y}` }

  function move(pos: Position, dir: Direction): Position {
    const d = DIRECTION_MAP[dir]
    return { x: pos.x + d.x, y: pos.y + d.y }
  }

  function inBounds(p: Position): boolean {
    return p.x >= 0 && p.x < GAME_CONFIG.gridSize && p.y >= 0 && p.y < GAME_CONFIG.gridSize
  }

  function dirBetween(a: Position, b: Position): Direction | null {
    if (b.x === a.x + 1 && b.y === a.y) return 'right'
    if (b.x === a.x - 1 && b.y === a.y) return 'left'
    if (b.x === a.x && b.y === a.y + 1) return 'down'
    if (b.x === a.x && b.y === a.y - 1) return 'up'
    return null
  }

  // Build zigzag Hamiltonian cycle
  function buildCycle() {
    const n = GAME_CONFIG.gridSize
    const c: Position[] = []
    for (let y = 0; y < n; y++) {
      if (y % 2 === 0) { for (let x = 0; x < n; x++) c.push({ x, y }) }
      else { for (let x = n - 1; x >= 0; x--) c.push({ x, y }) }
    }
    cycle = c
    cycleIdx = new Map()
    for (let i = 0; i < c.length; i++) cycleIdx.set(pk(c[i]), i)
  }

  // Occupied set: all body segments + obstacles
  function occupied(): Set<string> {
    const s = new Set<string>()
    for (const seg of state.snake) s.add(pk(seg))
    for (const o of state.obstacles) s.add(pk(o))
    return s
  }

  // BFS: returns first-step direction to target, or null
  function bfs(start: Position, target: Position, occ: Set<string>): Direction | null {
    const vis = new Set<string>()
    const q: { p: Position; d: Direction }[] = []
    vis.add(pk(start))
    for (const dir of DIRS) {
      const n = move(start, dir)
      if (inBounds(n) && !occ.has(pk(n))) {
        vis.add(pk(n))
        if (n.x === target.x && n.y === target.y) return dir
        q.push({ p: n, d: dir })
      }
    }
    while (q.length > 0) {
      const { p, d } = q.shift()!
      for (const dir of DIRS) {
        const n = move(p, dir)
        const k = pk(n)
        if (!inBounds(n) || occ.has(k) || vis.has(k)) continue
        vis.add(k)
        if (n.x === target.x && n.y === target.y) return d
        q.push({ p: n, d })
      }
    }
    return null
  }

  // Heuristic longest path: extend shortest path by detouring
  function longestPathLen(start: Position, target: Position, occ: Set<string>): number {
    // BFS shortest path
    const vis = new Set<string>()
    const q: { p: Position; len: number }[] = [{ p: start, len: 0 }]
    vis.add(pk(start))
    let bestLen = 0
    while (q.length > 0) {
      const { p, len } = q.shift()!
      if (p.x === target.x && p.y === target.y) { bestLen = len; break }
      for (const dir of DIRS) {
        const n = move(p, dir)
        const k = pk(n)
        if (!inBounds(n) || occ.has(k) || vis.has(k)) continue
        vis.add(k)
        q.push({ p: n, len: len + 1 })
      }
    }
    return bestLen
  }

  // Simulate snake moving along a BFS path step by step
  function simMove(start: Position, target: Position, occ: Set<string>): { snake: Position[]; reached: boolean } {
    // BFS to find full path
    const vis = new Map<string, { p: Position; dir: Direction }>()
    const q: Position[] = [start]
    vis.set(pk(start), { p: start, dir: 'right' })
    let found = false
    while (q.length > 0 && !found) {
      const p = q.shift()!
      for (const dir of DIRS) {
        const n = move(p, dir)
        const k = pk(n)
        if (!inBounds(n) || occ.has(k) || vis.has(k)) continue
        vis.set(k, { p, dir })
        if (n.x === target.x && n.y === target.y) { found = true; break }
        q.push(n)
      }
    }
    if (!found) return { snake: [], reached: false }

    // Reconstruct path
    const path: Position[] = []
    let cur = target
    while (cur.x !== start.x || cur.y !== start.y) {
      path.unshift(cur)
      const prev = vis.get(pk(cur))
      if (!prev) break
      cur = prev.p
    }

    // Simulate: move snake along path
    const simSnake = [...state.snake]
    for (const step of path) {
      simSnake.unshift(step)  // add new head
      simSnake.pop()           // remove tail (not eating yet)
    }
    // Last step: snake reaches food, grows (tail stays)
    // simSnake already has the new head + all old body (pop removed last tail)
    // But we need to NOT pop on the last step (eating)
    // Re-do: pop only path.length - 1 times
    const simSnake2 = [...state.snake]
    for (let i = 0; i < path.length; i++) {
      simSnake2.unshift(path[i])
      if (i < path.length - 1) simSnake2.pop() // don't pop on last step (eating)
    }
    return { snake: simSnake2, reached: true }
  }

  function findSafeDirection(): Direction {
    const headPos = head.value
    if (!headPos) return 'right'
    if (cycle.length === 0) buildCycle()

    const occ = occupied()
    const foodPos = state.food.pos
    const snakeLen = state.snake.length

    // Strategy 1: BFS shortcut to food
    const foodDir = bfs(headPos, foodPos, occ)
    if (foodDir) {
      // Simulate: snake moves along path to food, grows at end
      const sim = simMove(headPos, foodPos, occ)
      if (sim.reached) {
        // Build occupied from simulated snake
        const simOcc = new Set<string>()
        for (const seg of sim.snake) simOcc.add(pk(seg))
        for (const o of state.obstacles) simOcc.add(pk(o))
        // Check: can head reach any point ahead on the cycle?
        // Use longest path heuristic: if head can find a path longer than snake, it's safe
        const simHead = sim.snake[0]
        const simTail = sim.snake[sim.snake.length - 1]
        const pathLen = longestPathLen(simHead, simTail, simOcc)
        if (pathLen >= snakeLen) {
          return foodDir
        }
      }
    }

    // Strategy 2: Follow Hamiltonian cycle
    const hIdx = cycleIdx.get(pk(headPos))
    if (hIdx !== undefined) {
      const nextCell = cycle[(hIdx + 1) % cycle.length]
      if (!occ.has(pk(nextCell)) && inBounds(nextCell)) {
        const d = dirBetween(headPos, nextCell)
        if (d) return d
      }
      // Cycle blocked: BFS to next reachable cycle cell
      for (let off = 1; off < cycle.length; off++) {
        const target = cycle[(hIdx + off) % cycle.length]
        if (!occ.has(pk(target)) && inBounds(target)) {
          const d = bfs(headPos, target, occ)
          if (d) return d
        }
      }
    }

    // Strategy 3: Any safe direction
    for (const dir of DIRS) {
      const n = move(headPos, dir)
      if (inBounds(n) && !occ.has(pk(n))) return dir
    }
    return 'right'
  }

  buildCycle()

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
