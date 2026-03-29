import type { Direction, Position } from '../types/game'

const G = 20
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]
const DIRS: Direction[] = ['up', 'right', 'down', 'left']

function floodFill(blocked: Uint8Array, sx: number, sy: number): number {
  const vis = new Uint8Array(G * G)
  const qx = new Int32Array(G * G), qy = new Int32Array(G * G)
  let h = 0, t = 0
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

export function findSafeDirection(
  snake: Position[],
  food: Position,
  obstacles: Position[],
  tailFrozen: boolean,
): Direction {
  if (snake.length === 0) return 'right'

  const hx = snake[0].x, hy = snake[0].y
  const fx = food.x, fy = food.y
  const tx = snake[snake.length - 1].x, ty = snake[snake.length - 1].y

  // Build blocked grid
  const blocked = new Uint8Array(G * G)
  const bodyEnd = tailFrozen ? snake.length : snake.length - 1
  for (let i = 0; i < bodyEnd; i++) blocked[snake[i].y * G + snake[i].x] = 1
  for (const o of obstacles) blocked[o.y * G + o.x] = 1

  let bestDir: Direction = 'right'
  let bestScore = -Infinity

  for (let di = 0; di < 4; di++) {
    const nx = hx + DX[di], ny = hy + DY[di]
    // Skip walls
    if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
    // Skip reverse (into neck)
    if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
    // Skip body/obstacle
    if (blocked[ny * G + nx]) continue

    const eats = nx === fx && ny === fy
    const nextLen = eats ? snake.length + 1 : snake.length

    // Simulate: board after move
    const simBlocked = new Uint8Array(blocked)
    if (!eats) simBlocked[ty * G + tx] = 0 // tail moves away
    // New head NOT blocked for flood fill

    // Reachable space from new head
    const space = floodFill(simBlocked, nx, ny)

    // Hard safety: must have room for the snake
    if (space < nextLen) continue

    // Score
    let score = 0

    // Eating: be more conservative as snake gets longer
    // Need proportionally more space for longer snakes
    const safetyMargin = Math.max(nextLen * 1.5, 30) // At least 30 cells margin
    if (eats && space >= nextLen + safetyMargin) {
      score += 10000000 // Very safe to eat
    } else if (eats && space >= nextLen * 2) {
      score += 1000000 // Safe to eat
    } else if (eats) {
      // Too dangerous to eat - snake would trap itself
      score -= 10000000
    }

    // Prefer moving toward food (when safe)
    const foodDist = Math.abs(nx - fx) + Math.abs(ny - fy)
    if (space >= nextLen * 2) {
      score -= foodDist * 100 // Pursue food when we have room
    } else {
      score -= foodDist * 10 // Mild preference when tight
    }

    // Prefer more space (survival is priority)
    score += space * 5

    // Follow tail to maintain safe loop pattern
    const tailDist = Math.abs(nx - tx) + Math.abs(ny - ty)
    if (space < nextLen * 3) {
      score -= tailDist * 50 // Strong tail following when space is limited
    } else {
      score -= tailDist * 10 // Mild tail following when safe
    }

    if (score > bestScore) {
      bestScore = score
      bestDir = DIRS[di]
    }
  }

  // Emergency: no safe move, pick any valid
  if (bestScore === -Infinity) {
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
      if (!blocked[ny * G + nx]) return DIRS[di]
    }
  }

  return bestDir
}
