import type { Position, FoodType, Food } from '../types/game'

export function randomPosition(gridSize: number, exclude: Position[] = []): Position {
  const maxAttempts = gridSize * gridSize
  for (let i = 0; i < maxAttempts; i++) {
    const pos: Position = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    }
    if (!exclude.some((p) => p.x === pos.x && p.y === pos.y)) {
      return pos
    }
  }
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!exclude.some((p) => p.x === x && p.y === y)) {
        return { x, y }
      }
    }
  }
  return { x: 0, y: 0 }
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}

export function clampSpeed(
  score: number,
  config: {
    initialSpeed: number
    speedIncrement: number
    maxSpeed: number
  },
): number {
  const speed = config.initialSpeed - Math.floor(score / 50) * config.speedIncrement
  return Math.max(speed, config.maxSpeed)
}

export function randomFoodType(): FoodType {
  const r = Math.random()
  if (r < 0.1) return 'bonus' // 10% chance
  if (r < 0.18) return 'slow' // 8% chance
  return 'normal'
}

export function spawnFood(gridSize: number, snake: Position[], obstacles: Position[]): Food {
  const exclude = [...snake, ...obstacles]
  const pos = randomPosition(gridSize, exclude)
  const type = randomFoodType()
  const expiresAt = type === 'bonus' ? Date.now() + 8000 : undefined
  return { pos, type, expiresAt }
}

// BFS flood fill: count reachable cells from (sx, sy)
function floodFill(gridSize: number, blocked: Uint8Array, sx: number, sy: number): number {
  const G = gridSize
  const vis = new Uint8Array(G * G)
  const qx = new Int32Array(G * G), qy = new Int32Array(G * G)
  let h = 0, t = 0
  if (blocked[sy * G + sx]) return 0
  vis[sy * G + sx] = 1; qx[t] = sx; qy[t] = sy; t++
  let cnt = 1
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]
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

export function generateObstacles(
  gridSize: number,
  snake: Position[],
  food: Position,
  count: number,
): Position[] {
  const G = gridSize
  const cx = Math.floor(G / 2)
  const cy = Math.floor(G / 2)

  // Build exclude list for obstacle PLACEMENT: snake, food, center safe zone
  const exclude: Position[] = [...snake, food]
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const nx = cx + dx, ny = cy + dy
      if (nx >= 0 && nx < G && ny >= 0 && ny < G) {
        exclude.push({ x: nx, y: ny })
      }
    }
  }

  const obstacles: Position[] = []
  // Minimum open cells required (at least 50% of grid)
  const minOpen = Math.floor(G * G * 0.5)

  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < 50; attempt++) {
      const pos = randomPosition(G, [...exclude, ...obstacles])

      // Build blocked grid to test (food is NOT blocked - snake can reach it)
      const blocked = new Uint8Array(G * G)
      // Block snake body EXCEPT head
      for (let si = 1; si < snake.length; si++) blocked[snake[si].y * G + snake[si].x] = 1
      // Block existing obstacles + new candidate
      for (const o of obstacles) blocked[o.y * G + o.x] = 1
      blocked[pos.y * G + pos.x] = 1

      // Check reachable area from snake head
      const reach = floodFill(G, blocked, snake[0].x, snake[0].y)
      if (reach >= minOpen) {
        obstacles.push(pos)
        placed = true
        break
      }
    }
    if (!placed) break
  }

  return obstacles
}
