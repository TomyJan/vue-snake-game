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
  let tailFrozen = false // true after eating: tail doesn't move next turn

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
    tailFrozen = false

    startDelayTimer = setTimeout(() => {
      if (state.status === 'starting') {
        state.status = 'playing'
        startGameTimer()
        startParticleTimer()
      }
    }, START_DELAY_MS)
  }

  function endGame() {
    clearTimers()
    state.status = 'idle'
  }

  function pauseGame() {
    if (state.status === 'playing') {
      state.status = 'paused'
      stopGameTimer()
      }
  }

  function resumeGame() {
    if (state.status === 'paused') {
      state.status = 'playing'
      startGameTimer()
    }
  }

  function togglePause() {
    if (state.status === 'playing') pauseGame()
    else if (state.status === 'paused') resumeGame()
  }

  function gameOver() {
    state.status = 'gameover'
    clearTimers()
    if (state.score > highScore.value) {
      highScore.value = state.score
      localStorage.setItem(HIGH_SCORE_KEY, String(state.score))
      state.highScore = state.score
    }
  }

  function emitParticles(x: number, y: number, color: string, count: number = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const spd = 2 + Math.random() * 3
      state.particles.push({
        x: x * GAME_CONFIG.cellSize + GAME_CONFIG.cellSize / 2,
        y: y * GAME_CONFIG.cellSize + GAME_CONFIG.cellSize / 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
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
    state.speed = Math.min(baseSpeed.value + 60, 350)
    restartGameTimer()
    if (slowBuffTimer) clearTimeout(slowBuffTimer)
    slowBuffTimer = setTimeout(() => {
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

    if (newHead.x < 0 || newHead.x >= GAME_CONFIG.gridSize || newHead.y < 0 || newHead.y >= GAME_CONFIG.gridSize) {
      gameOver()
      return { hit: true }
    }

    if (state.snake.some((seg, i) => {
      if (i === 0) return false // skip head
      if (i === state.snake.length - 1 && !tailFrozen) return false // tail moves away
      return positionsEqual(seg, newHead)
    })) {
      gameOver()
      return { hit: true }
    }

    if (state.obstacles.some((o) => positionsEqual(o, newHead))) {
      gameOver()
      return { hit: true }
    }

    if (state.food.expiresAt && Date.now() > state.food.expiresAt) {
      state.food = spawnFood(GAME_CONFIG.gridSize, state.snake, state.obstacles)
    }

    const ate = positionsEqual(newHead, state.food.pos)
    state.snake.unshift(newHead)

    if (ate) {
      // Snake grows: tail stays, mark it frozen for next AI check
      tailFrozen = true
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
      tailFrozen = false
      return { ate: false }
    }
  }

  function startGameTimer() {
    stopGameTimer()
    gameTimer = setInterval(() => {
      if (aiEnabled.value) { const dir = findSafeDirection(); if (dir) state.nextDirection = dir }
      moveSnake()
    }, state.speed)
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

  // ===== AI =====

  // Flood fill: count reachable cells from (sx, sy) avoiding blocked cells
  function floodFill(blocked: Uint8Array, sx: number, sy: number): number {
    const G = GAME_CONFIG.gridSize
    const vis = new Uint8Array(G * G)
    const qx = new Int32Array(G * G), qy = new Int32Array(G * G)
    let h = 0, t = 0
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]
    if (blocked[sy * G + sx]) return 0
    vis[sy * G + sx] = 1; qx[t] = sx; qy[t] = sy; t++
    let cnt = 1
    while (h < t) {
      const cx = qx[h], cy = qy[h]; h++
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d]
        if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
        const idx = ny * G + nx
        if (vis[idx] || blocked[idx]) continue
        vis[idx] = 1; qx[t] = nx; qy[t] = ny; t++; cnt++
      }
    }
    return cnt
  }

  function findSafeDirection(): Direction {
    const sn = state.snake
    if (sn.length === 0) return 'right'
    const G = GAME_CONFIG.gridSize
    const hx = sn[0].x, hy = sn[0].y
    const fx = state.food.pos.x, fy = state.food.pos.y
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]
    const dirs: Direction[] = ['up', 'right', 'down', 'left']

    // Build blocked grid: body + obstacles
    const blocked = new Uint8Array(G * G)
    const bodyEnd = tailFrozen ? sn.length : sn.length - 1
    for (let i = 0; i < bodyEnd; i++) blocked[sn[i].y * G + sn[i].x] = 1
    for (const o of state.obstacles) blocked[o.y * G + o.x] = 1

    // Current reachable space
    const currentSpace = floodFill(blocked, hx, hy)

    interface DirScore { dir: Direction; score: number; space: number; dist: number }
    const candidates: DirScore[] = []

    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      // Skip walls
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      // Skip reverse (into neck)
      if (sn.length > 1 && nx === sn[1].x && ny === sn[1].y) continue
      // Skip blocked
      if (blocked[ny * G + nx]) continue

      const eats = nx === fx && ny === fy

      // Simulate move: what the board looks like after the move
      const simBlocked = new Uint8Array(blocked)
      // Don't block new head - it's the starting point for flood fill
      if (!eats) {
        // Tail moves away (free it)
        const tailIdx = sn.length - 1
        simBlocked[sn[tailIdx].y * G + sn[tailIdx].x] = 0
      }
      // Block old body cells that are still there (head moves, rest follows)
      // The new head is NOT blocked - it's where we start the flood fill

      // After eating: snake is 1 longer, need more space
      const simLen = eats ? sn.length + 1 : sn.length

      // Count reachable space from new head position
      const space = floodFill(simBlocked, nx, ny)

      // Must have enough space for the snake
      if (space < simLen) continue

      const dist = Math.abs(nx - fx) + Math.abs(ny - fy)
      candidates.push({ dir: dirs[di], score: 0, space, dist })
    }

    if (candidates.length === 0) {
      // No safe move: emergency - pick any valid direction
      for (let di = 0; di < 4; di++) {
        const nx = hx + DX[di], ny = hy + DY[di]
        if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
        if (sn.length > 1 && nx === sn[1].x && ny === sn[1].y) continue
        if (!blocked[ny * G + nx]) return dirs[di]
      }
      return state.direction
    }

    // Score each candidate
    for (const c of candidates) {
      const nx = hx + DX[dirs.indexOf(c.dir)], ny = hy + DY[dirs.indexOf(c.dir)]
      const eats = nx === fx && ny === fy
      const simLen = eats ? sn.length + 1 : sn.length

      // Space score: prefer more space (survival first)
      let spaceScore = c.space

      // If space is tight (< 2x snake length), heavily prioritize space
      if (c.space < simLen * 2) {
        spaceScore = c.space * 100
      }

      // Food score: only pursue if safe
      let foodScore = 0
      if (eats) {
        // Always take food if we have enough space
        if (c.space >= simLen * 2) {
          foodScore = 10000
        } else {
          // Tight space: still take food but with lower priority
          foodScore = 1000
        }
      } else {
        // Prefer moving toward food when not eating
        foodScore = (currentSpace - c.dist) * 0.5
      }

      // Follow-tail bonus: when space is limited, prefer moving toward tail
      // This creates a safe "loop" pattern
      if (c.space < simLen * 3 && sn.length > 3) {
        const tx = sn[sn.length - 1].x, ty = sn[sn.length - 1].y
        const tailDist = Math.abs(nx - tx) + Math.abs(ny - ty)
        // Closer to tail = better when space is tight
        spaceScore += (20 - tailDist) * 50
      }

      c.score = spaceScore + foodScore
    }

    // Pick best
    candidates.sort((a, b) => b.score - a.score)
    return candidates[0].dir
  }


  function toggleAI() { aiEnabled.value = !aiEnabled.value }

  function setSpeed(speed: number) {
    baseSpeed.value = speed
    if (state.status === 'idle') state.speed = speed
  }

  onUnmounted(() => { clearTimers() })

  return {
    state, head, length, aiEnabled, baseSpeed,
    startGame, endGame, pauseGame, resumeGame, togglePause,
    setDirection, handleKeydown, moveSnake,
    toggleAI, setSpeed,
  }
}
