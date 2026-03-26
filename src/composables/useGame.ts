import { ref, reactive, computed, onUnmounted } from 'vue'
import type { GameState, Direction, Position, Food } from '../types/game'
import {
  GAME_CONFIG,
  DIRECTION_MAP,
  OPPOSITE_DIRECTION,
  KEY_DIRECTION_MAP,
  OBSTACLE_COUNT,
} from '../utils/constants'
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
    state.obstacles = generateObstacles(
      GAME_CONFIG.gridSize,
      state.snake,
      { x: 0, y: 0 },
      OBSTACLE_COUNT,
    )
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

    if (
      newHead.x < 0 ||
      newHead.x >= GAME_CONFIG.gridSize ||
      newHead.y < 0 ||
      newHead.y >= GAME_CONFIG.gridSize
    ) {
      gameOver()
      return { hit: true }
    }

    if (state.snake.some((seg) => positionsEqual(seg, newHead))) {
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

  // ===== Game tick: AI decides direction, then snake moves =====
  function gameTick() {
    if (aiEnabled.value) {
      const dir = computeBestDirection()
      if (dir) {
        state.nextDirection = dir
      } else {
        // AI found no safe direction — try to find ANY non-collision direction
        const sn = state.snake
        if (sn.length > 0) {
          const hx = sn[0].x,
            hy = sn[0].y
          for (const d of DIRS) {
            const dd = DIRECTION_MAP[d]
            const nx = hx + dd.x,
              ny = hy + dd.y
            if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
            if (sn.length > 1 && nx === sn[1].x && ny === sn[1].y) continue
            const blocked = tailFrozen ? sn.length : sn.length - 1
            let hit = false
            for (let i = 1; i < blocked; i++) {
              if (sn[i].x === nx && sn[i].y === ny) {
                hit = true
                break
              }
            }
            if (!hit) {
              for (const o of state.obstacles) {
                if (o.x === nx && o.y === ny) {
                  hit = true
                  break
                }
              }
            }
            if (!hit) {
              state.nextDirection = d
              break
            }
          }
        }
      }
    }
    moveSnake()
  }

  function startGameTimer() {
    stopGameTimer()
    gameTimer = setInterval(gameTick, state.speed)
  }

  function stopGameTimer() {
    if (gameTimer) {
      clearInterval(gameTimer)
      gameTimer = null
    }
  }

  function restartGameTimer() {
    if (state.status === 'playing') startGameTimer()
  }

  function startParticleTimer() {
    stopParticleTimer()
    particleTimer = setInterval(updateParticles, 16)
  }

  function stopParticleTimer() {
    if (particleTimer) {
      clearInterval(particleTimer)
      particleTimer = null
    }
  }

  function clearTimers() {
    stopGameTimer()
    stopParticleTimer()
    if (startDelayTimer) {
      clearTimeout(startDelayTimer)
      startDelayTimer = null
    }
    if (slowBuffTimer) {
      clearTimeout(slowBuffTimer)
      slowBuffTimer = null
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

  // ===== AI: Chase-tail survival + safe food eating =====
  // Core idea: always chase your own tail. The tail moves away each turn,
  // so following it guarantees you never trap yourself.
  // Only divert to eat food when it's safe (enough space after eating).
  const DIRS: Direction[] = ['up', 'right', 'down', 'left']
  const G = GAME_CONFIG.gridSize

  // BFS: find first step of shortest path from (sx,sy) to (tx,ty) avoiding occ
  // Returns direction, or null if unreachable
  function bfsFirstStep(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    occ: Uint8Array,
  ): Direction | null {
    if (sx === tx && sy === ty) return null
    const visited = new Uint8Array(G * G)
    // prevDir[i] = direction index (0-3) that led to cell i, or -1 for start
    const prevDir = new Int8Array(G * G).fill(-1)
    const qx = new Int32Array(G * G)
    const qy = new Int32Array(G * G)
    let h = 0,
      t = 0
    visited[sy * G + sx] = 1
    qx[t] = sx
    qy[t] = sy
    t++
    while (h < t) {
      const cx = qx[h],
        cy = qy[h]
      h++
      if (cx === tx && cy === ty) {
        // Found target. Backtrack to find cell right after start.
        let px = tx,
          py = ty
        while (true) {
          const idx = py * G + px
          const pd = prevDir[idx]
          if (pd === -1) return null // somehow at start
          const dd = DIRECTION_MAP[DIRS[pd]]
          const prevX = px - dd.x,
            prevY = py - dd.y
          if (prevX === sx && prevY === sy) {
            // prevDir[idx] is the direction FROM start TO this cell
            return DIRS[pd]
          }
          px = prevX
          py = prevY
        }
      }
      for (let di = 0; di < 4; di++) {
        const dd = DIRECTION_MAP[DIRS[di]]
        const nx = cx + dd.x,
          ny = cy + dd.y
        if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
        const idx = ny * G + nx
        if (visited[idx] || occ[idx]) continue
        visited[idx] = 1
        prevDir[idx] = di
        qx[t] = nx
        qy[t] = ny
        t++
      }
    }
    return null // unreachable
  }

  // BFS: count reachable cells from (sx, sy)
  function bfsCount(sx: number, sy: number, occ: Uint8Array): number {
    const visited = new Uint8Array(G * G)
    const qx = new Int32Array(G * G)
    const qy = new Int32Array(G * G)
    let h = 0,
      t = 0
    visited[sy * G + sx] = 1
    qx[t] = sx
    qy[t] = sy
    t++
    let count = 1
    while (h < t) {
      const cx = qx[h],
        cy = qy[h]
      h++
      for (const d of DIRS) {
        const dd = DIRECTION_MAP[d]
        const nx = cx + dd.x,
          ny = cy + dd.y
        if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
        const idx = ny * G + nx
        if (visited[idx] || occ[idx]) continue
        visited[idx] = 1
        qx[t] = nx
        qy[t] = ny
        t++
        count++
      }
    }
    return count
  }

  // Build occupied array for current snake state
  function buildOcc(): Uint8Array {
    const sn = state.snake
    const occ = new Uint8Array(G * G)
    const end = tailFrozen ? sn.length : sn.length - 1
    for (let i = 1; i < end; i++) {
      occ[sn[i].y * G + sn[i].x] = 1
    }
    for (const o of state.obstacles) {
      occ[o.y * G + o.x] = 1
    }
    return occ
  }

  function computeBestDirection(): Direction | null {
    const sn = state.snake
    if (sn.length === 0) return null
    if (sn.length === 1) {
      // Single segment, just go toward food
      const hx = sn[0].x,
        hy = sn[0].y
      const fx = state.food.pos.x,
        fy = state.food.pos.y
      if (fx > hx) return 'right'
      if (fx < hx) return 'left'
      if (fy > hy) return 'down'
      return 'up'
    }

    const hx = sn[0].x,
      hy = sn[0].y
    const fx = state.food.pos.x,
      fy = state.food.pos.y
    const tx = sn[sn.length - 1].x,
      ty = sn[sn.length - 1].y
    const occ = buildOcc()

    // Can we reach the food?
    const foodDir = bfsFirstStep(hx, hy, fx, fy, occ)

    if (foodDir && !tailFrozen) {
      // Food is reachable. Is it safe to eat?
      // Simulate: head moves to food, snake grows, tail stays
      const dd = DIRECTION_MAP[foodDir]
      const nx = hx + dd.x,
        ny = hy + dd.y
      const simOcc = new Uint8Array(occ)
      simOcc[ny * G + nx] = 1 // new head (food position)
      // tail stays (don't remove it)
      const space = bfsCount(nx, ny, simOcc)
      // After eating: snake is sn.length + 1
      // Need at least snake.length + 1 space to survive
      if (space >= sn.length + 1) {
        // Verify we can still reach the tail after eating
        const tailDir = bfsFirstStep(nx, ny, tx, ty, simOcc)
        if (tailDir) {
          return foodDir
        }
      }
    }

    // No safe food path → chase the tail
    // This guarantees we never trap ourselves
    if (!tailFrozen) {
      const tailDir = bfsFirstStep(hx, hy, tx, ty, occ)
      if (tailDir) return tailDir
    }

    // Tail unreachable (shouldn't happen normally) → greedy space max
    let bestDir: Direction | null = null
    let bestSpace = -1
    for (const d of DIRS) {
      const dd = DIRECTION_MAP[d]
      const nx = hx + dd.x,
        ny = hy + dd.y
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (nx === sn[1].x && ny === sn[1].y) continue
      if (occ[ny * G + nx]) continue
      const simOcc = new Uint8Array(occ)
      simOcc[ny * G + nx] = 1
      if (!tailFrozen) {
        simOcc[sn[sn.length - 1].y * G + sn[sn.length - 1].x] = 0
      }
      const space = bfsCount(nx, ny, simOcc)
      if (space > bestSpace) {
        bestSpace = space
        bestDir = d
      }
    }
    return bestDir
  }

  // Removed: separate aiInterval timer.
  // AI decisions are now integrated into gameTick() above.

  function toggleAI() {
    aiEnabled.value = !aiEnabled.value
  }

  function setSpeed(speed: number) {
    baseSpeed.value = speed
    if (state.status === 'idle') state.speed = speed
  }

  onUnmounted(() => {
    clearTimers()
  })

  return {
    state,
    head,
    length,
    aiEnabled,
    baseSpeed,
    startGame,
    endGame,
    pauseGame,
    resumeGame,
    togglePause,
    setDirection,
    handleKeydown,
    moveSnake,
    toggleAI,
    setSpeed,
  }
}
