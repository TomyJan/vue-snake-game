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
  let tailFrozen = false // true after eating: tail does not move next turn

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
    // Failsafe: if AI direction leads to body collision, try other directions
    if (aiEnabled.value && state.snake.length > 1) {
      const delta = DIRECTION_MAP[state.nextDirection]
      const nhx = head.value.x + delta.x
      const nhy = head.value.y + delta.y
      const willHit = state.snake.some((seg, i) => i > 0 && seg.x === nhx && seg.y === nhy)
      if (willHit) {
        for (const d of DIRS) {
          const dd = DIRECTION_MAP[d]
          const tx = head.value.x + dd.x, ty = head.value.y + dd.y
          if (tx < 0 || tx >= GAME_CONFIG.gridSize || ty < 0 || ty >= GAME_CONFIG.gridSize) continue
          if (tx === state.snake[1].x && ty === state.snake[1].y) continue
          if (!state.snake.some((seg) => seg.x === tx && seg.y === ty) &&
              !state.obstacles.some((o) => o.x === tx && o.y === ty)) {
            state.nextDirection = d
            break
          }
        }
      }
    }
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
      gameTick()
    }, state.speed)
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



          // ===== AI: Hamiltonian Cycle + BFS Shortcuts =====
  const G = GAME_CONFIG.gridSize
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]
  const DIRS: Direction[] = ["up", "right", "down", "left"]
  function computeBestDir(): Direction | null {
    const sn = state.snake
    if (sn.length === 0) return "right"
    if (sn.length === 1) {
      const f = state.food.pos
      if (f.x > sn[0].x) return "right"
      if (f.x < sn[0].x) return "left"
      if (f.y > sn[0].y) return "down"
      return "up"
    }
    const hx = sn[0].x, hy = sn[0].y
    const fx = state.food.pos.x, fy = state.food.pos.y
    const tx = sn[sn.length - 1].x, ty = sn[sn.length - 1].y
    const occ = new Uint8Array(G * G)
    for (let i = 1; i < sn.length; i++) occ[sn[i].y * G + sn[i].x] = 1
    for (const o of state.obstacles) occ[o.y * G + o.x] = 1
    function bfs(sx: number, sy: number, txx: number, tyy: number, o: Uint8Array): number[] | null {
      if (sx === txx && sy === tyy) return []
      const N = G * G, vis = new Uint8Array(N), pr = new Int8Array(N).fill(-1)
      const qx = new Int32Array(N), qy = new Int32Array(N)
      let h = 0, t = 0; vis[sy * G + sx] = 1; qx[t] = sx; qy[t] = sy; t++
      while (h < t) { const cx = qx[h], cy = qy[h]; h++
        if (cx === txx && cy === tyy) { const p: number[] = []; let px = txx, py = tyy
          while (px !== sx || py !== sy) { const pd = pr[py * G + px]; p.push(pd); px -= DX[pd]; py -= DY[pd] }
          p.reverse(); return p }
        for (let di = 0; di < 4; di++) { const nx = cx + DX[di], ny = cy + DY[di]
          if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
          const idx = ny * G + nx; if (vis[idx] || o[idx]) continue
          vis[idx] = 1; pr[idx] = di; qx[t] = nx; qy[t] = ny; t++ } }
      return null }
    // Step 1: BFS to food, simulate eating, check head can reach tail
    const fp = bfs(hx, hy, fx, fy, occ)
    if (fp !== null && fp.length > 0) {
      const vo = new Uint8Array(G * G)
      for (let i = 1; i < sn.length; i++) vo[sn[i].y * G + sn[i].x] = 1
      for (const o of state.obstacles) vo[o.y * G + o.x] = 1
      let vhx = hx, vhy = hy
      for (const di of fp) { vo[vhy * G + vhx] = 1; vhx += DX[di]; vhy += DY[di] }
      vo[ty * G + tx] = 0
      const esc = bfs(vhx, vhy, tx, ty, vo)
      if (esc !== null) return DIRS[fp[0]]
    }
    // Step 2: pick direction where head can still reach tail after moving
    let best: Direction | null = null, bs = -1, bd = 1e9
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (nx === sn[1].x && ny === sn[1].y) continue
      if (occ[ny * G + nx]) continue
      const simO = new Uint8Array(occ); simO[ny * G + nx] = 1; simO[ty * G + tx] = 0
      // Critical: check head can reach tail after this move
      const reachable = bfs(nx, ny, tx, ty, simO)
      if (reachable === null) continue
      // Count space for scoring
      const vis2 = new Uint8Array(G * G), qx2 = new Int32Array(G * G), qy2 = new Int32Array(G * G)
      let h2 = 0, t2 = 0; vis2[ny * G + nx] = 1; qx2[t2] = nx; qy2[t2] = ny; t2++
      let cnt = 1
      while (h2 < t2) { const cx = qx2[h2], cy = qy2[h2]; h2++
        for (let d = 0; d < 4; d++) { const nnx = cx + DX[d], nny = cy + DY[d]
          if (nnx < 0 || nnx >= G || nny < 0 || nny >= G) continue
          const idx = nny * G + nnx; if (vis2[idx] || simO[idx]) continue
          vis2[idx] = 1; qx2[t2] = nnx; qy2[t2] = nny; t2++; cnt++ } }
      const dist = Math.abs(nx - fx) + Math.abs(ny - fy)
        if (cnt > bs || (cnt === bs && dist < bd)) { bs = cnt; bd = dist; best = DIRS[di] }
    }
    if (best !== null) return best
    // Step 3: no safe direction found, pick any valid direction to avoid wall
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (nx === sn[1].x && ny === sn[1].y) continue
      if (!occ[ny * G + nx]) return DIRS[di]
    }
    return null
  }
  function gameTick() { void tailFrozen
    if (aiEnabled.value) { const dir = computeBestDir(); if (dir) state.nextDirection = dir }
    moveSnake() }
function toggleAI() { aiEnabled.value = !aiEnabled.value }

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
