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
      if (dir) state.nextDirection = dir
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

  // ===== AI =====
  const DIRS: Direction[] = ['up', 'right', 'down', 'left']
  const G = GAME_CONFIG.gridSize

  function k(x: number, y: number): string {
    return `${x},${y}`
  }
  function inB(x: number, y: number): boolean {
    return x >= 0 && x < G && y >= 0 && y < G
  }

  // Build a Set of occupied positions for the snake
  // excludeTail: if true, the tail position is NOT included (snake will move away)
  function buildBlocked(includeTail: boolean): Set<string> {
    const s = new Set<string>()
    const end = includeTail ? state.snake.length : state.snake.length - 1
    for (let i = 1; i < end; i++) {
      s.add(k(state.snake[i].x, state.snake[i].y))
    }
    for (const o of state.obstacles) s.add(k(o.x, o.y))
    return s
  }

  // BFS: find shortest path from (sx,sy) to (tx,ty) avoiding blocked cells
  // Returns the path as an array of [x,y] (excluding start), or null if no path
  function bfsPath(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    blocked: Set<string>,
  ): [number, number][] | null {
    const vis = new Set<string>()
    const qx: number[] = [sx]
    const qy: number[] = [sy]
    const prevX = new Map<string, number>()
    const prevY = new Map<string, number>()
    vis.add(k(sx, sy))

    let head2 = 0
    while (head2 < qx.length) {
      const cx = qx[head2],
        cy = qy[head2]
      head2++
      if (cx === tx && cy === ty) {
        // Reconstruct path
        const path: [number, number][] = []
        let px = tx,
          py = ty
        while (px !== sx || py !== sy) {
          path.push([px, py])
          const pk = k(px, py)
          px = prevX.get(pk)!
          py = prevY.get(pk)!
        }
        path.reverse()
        return path
      }
      for (const d of DIRS) {
        const dd = DIRECTION_MAP[d]
        const nx = cx + dd.x,
          ny = cy + dd.y
        const nk = k(nx, ny)
        if (!inB(nx, ny) || blocked.has(nk) || vis.has(nk)) continue
        vis.add(nk)
        prevX.set(nk, cx)
        prevY.set(nk, cy)
        qx.push(nx)
        qy.push(ny)
      }
    }
    return null
  }

  // BFS: count reachable cells from (sx,sy)
  function floodCount(sx: number, sy: number, blocked: Set<string>): number {
    const vis = new Set<string>()
    const qx: number[] = [sx]
    const qy: number[] = [sy]
    vis.add(k(sx, sy))
    let head2 = 0
    while (head2 < qx.length) {
      const cx = qx[head2],
        cy = qy[head2]
      head2++
      for (const d of DIRS) {
        const dd = DIRECTION_MAP[d]
        const nx = cx + dd.x,
          ny = cy + dd.y
        const nk = k(nx, ny)
        if (!inB(nx, ny) || blocked.has(nk) || vis.has(nk)) continue
        vis.add(nk)
        qx.push(nx)
        qy.push(ny)
      }
    }
    return vis.size
  }

  // Check if snake can survive after taking a step to (nx, ny)
  // Returns true if there's enough space
  function canSurvive(nx: number, ny: number, eating: boolean): boolean {
    const blocked = eating ? buildBlocked(true) : buildBlocked(false)
    blocked.add(k(nx, ny))

    let space: number
    if (eating) {
      space = floodCount(nx, ny, blocked)
      // After eating, snake is longer by 1, need at least snake.length + 1 space
      return space >= state.snake.length + 1
    } else {
      const tail = state.snake[state.snake.length - 1]
      blocked.delete(k(tail.x, tail.y))
      space = floodCount(nx, ny, blocked)
      // Snake doesn't grow, need at least current length space
      return space >= state.snake.length
    }
  }

  function computeBestDirection(): Direction | null {
    const hp = head.value
    if (!hp || state.snake.length === 0) return null

    const hx = hp.x,
      hy = hp.y
    const fx = state.food.pos.x,
      fy = state.food.pos.y
    const tail = state.snake[state.snake.length - 1]

    // Get valid adjacent positions (no walls, no body, no reverse)
    const candidates: { dir: Direction; x: number; y: number }[] = []
    for (const d of DIRS) {
      const dd = DIRECTION_MAP[d]
      const nx = hx + dd.x,
        ny = hy + dd.y
      if (!inB(nx, ny)) continue
      // Skip reverse (going into neck)
      if (state.snake.length > 1 && nx === state.snake[1].x && ny === state.snake[1].y) continue
      // Skip body/obstacle collision
      const blocked = buildBlocked(!tailFrozen)
      if (blocked.has(k(nx, ny))) continue
      candidates.push({ dir: d, x: nx, y: ny })
    }

    if (candidates.length === 0) return null

    // === Strategy 1: Path to food via BFS ===
    const blockedForFood = buildBlocked(!tailFrozen)
    const foodPath = bfsPath(hx, hy, fx, fy, blockedForFood)

    if (foodPath && foodPath.length > 0) {
      // Check if the first step of the path is safe
      const [firstX, firstY] = foodPath[0]
      const firstDir = candidates.find((c) => c.x === firstX && c.y === firstY)
      if (firstDir) {
        const eatsFood = firstX === fx && firstY === fy
        if (eatsFood ? canSurvive(firstX, firstY, true) : canSurvive(firstX, firstY, false)) {
          // Verify: simulate the full path, check if we can reach food safely
          // For each step on the path, check if there's enough room after
          let canComplete = true
          const simBlocked = new Set(blockedForFood)
          let snakeLen = state.snake.length
          let simTailIdx = state.snake.length - 1

          for (let i = 0; i < foodPath.length; i++) {
            const [px, py] = foodPath[i]
            const eatsHere = px === fx && py === fy

            if (eatsHere) {
              simBlocked.add(k(px, py))
              snakeLen++
            } else {
              // Move: tail frees, new head blocks
              if (simTailIdx >= 0) {
                simBlocked.delete(k(state.snake[simTailIdx].x, state.snake[simTailIdx].y))
                simTailIdx--
              }
              simBlocked.add(k(px, py))
            }

            // After eating, check if remaining space is sufficient
            if (eatsHere) {
              const remaining = floodCount(px, py, simBlocked)
              if (remaining < snakeLen) {
                canComplete = false
                break
              }
            }
          }

          if (canComplete) {
            return firstDir.dir
          }
        }
      }
    }

    // === Strategy 2: Chase tail (survival mode) ===
    // Move toward the tail to free up space
    let bestDir: Direction = candidates[0].dir
    let bestScore = -Infinity

    for (const c of candidates) {
      const eats = c.x === fx && c.y === fy

      // Safety check first
      if (eats && !canSurvive(c.x, c.y, true)) continue
      if (!eats && !canSurvive(c.x, c.y, false)) continue

      let score: number

      if (eats) {
        // Eating is usually good, but only if we survive
        score = 10000
      } else {
        // Evaluate reachable space after this move
        const blocked = buildBlocked(false)
        blocked.delete(k(tail.x, tail.y))
        blocked.add(k(c.x, c.y))
        const space = floodCount(c.x, c.y, blocked)

        // Prefer directions closer to tail (chase our own tail for survival)
        const distToTail = Math.abs(c.x - tail.x) + Math.abs(c.y - tail.y)

        // Also consider distance to food (for eventual eating)
        const distToFood = Math.abs(c.x - fx) + Math.abs(c.y - fy)

        // Space is king, but prefer being near tail when space is tight
        const spaceRatio = space / (state.snake.length * 2)
        if (spaceRatio < 0.5) {
          // Tight space: prioritize moving toward tail
          score = space * 50 - distToTail * 200
        } else {
          // Plenty of room: prioritize food
          score = space * 100 - distToFood * 10
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestDir = c.dir
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
