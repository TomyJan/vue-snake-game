import type { Direction, Position } from '../types/game'

const G = 20
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]
const DIRS: Direction[] = ['up', 'right', 'down', 'left']
const LOOKAHEAD = 30 // How many steps to simulate ahead

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

/**
 * Score a direction by simulating N steps ahead with the best follow-up moves.
 * Uses iterative deepening: tries all directions at each depth, keeps top candidates.
 */
function scoreDirection(
  blocked: Uint8Array,
  snakeBody: { x: number; y: number }[],
  firstDir: number,
  depth: number,
  tailFrozen: boolean,
): number {
  const hx = snakeBody[0].x, hy = snakeBody[0].y
  const nx = hx + DX[firstDir], ny = hy + DY[firstDir]

  // Quick wall/body check
  if (nx < 0 || nx >= G || ny < 0 || ny >= G) return -Infinity
  if (blocked[ny * G + nx]) return -Infinity

  // Build simulated snake after first move
  const simBody = [{ x: nx, y: ny }, ...snakeBody]
  const simBlocked = new Uint8Array(blocked)
  let frozen = tailFrozen

  if (!frozen) {
    const tail = simBody[simBody.length - 1]
    simBlocked[tail.y * G + tail.x] = 0
  }
  frozen = false // After first move, tail is no longer frozen

  if (depth <= 1) {
    return floodFill(simBlocked, nx, ny)
  }

  // Try all 3 remaining directions (exclude reverse) for the rest of the depth
  let bestScore = -Infinity
  for (let d = 0; d < 4; d++) {
    // Skip reverse direction
    if (firstDir === 0 && d === 2) continue // up vs down
    if (firstDir === 2 && d === 0) continue
    if (firstDir === 1 && d === 3) continue // right vs left
    if (firstDir === 3 && d === 1) continue

    const s = simulateDeep(simBlocked, simBody, d, depth - 1)
    if (s > bestScore) bestScore = s
  }

  return bestScore
}

/**
 * Recursively simulate a direction for `depth` steps, always picking the
 * direction that maximizes remaining space at each step (greedy lookahead).
 */
function simulateDeep(
  blocked: Uint8Array,
  body: { x: number; y: number }[],
  dir: number,
  depth: number,
): number {
  const nx = body[0].x + DX[dir], ny = body[0].y + DY[dir]
  if (nx < 0 || nx >= G || ny < 0 || ny >= G) return -Infinity
  if (blocked[ny * G + nx]) return -Infinity

  // Build new state
  const newBody = [{ x: nx, y: ny }, ...body]
  const newBlocked = new Uint8Array(blocked)
  const tail = newBody[newBody.length - 1]
  newBlocked[tail.y * G + tail.x] = 0
  newBody.pop()

  if (depth <= 0) {
    return floodFill(newBlocked, nx, ny)
  }

  // Pick best next direction greedily
  let best = -Infinity
  for (let d = 0; d < 4; d++) {
    if (dir === 0 && d === 2) continue
    if (dir === 2 && d === 0) continue
    if (dir === 1 && d === 3) continue
    if (dir === 3 && d === 1) continue
    const s = simulateDeep(newBlocked, newBody, d, depth - 1)
    if (s > best) best = s
  }
  return best
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

  // Adaptive lookahead: deeper when snake is longer or space is tight
  const totalSpace = G * G - snake.length - obstacles.length
  const fillRatio = snake.length / totalSpace
  const depth = fillRatio > 0.3 ? Math.min(LOOKAHEAD, 40) : Math.min(LOOKAHEAD, 20)

  for (let di = 0; di < 4; di++) {
    const nx = hx + DX[di], ny = hy + DY[di]
    // Skip walls
    if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
    // Skip reverse (into neck)
    if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
    // Skip body/obstacle
    if (blocked[ny * G + nx]) continue

    // --- Lookahead score ---
    const lookaheadScore = scoreDirection(blocked, snake, di, depth, tailFrozen)
    if (lookaheadScore === -Infinity) continue // This direction leads to death

    // --- Heuristic score on top of lookahead ---
    let score = lookaheadScore * 10000 // Primary: reachable space after N moves

    // Food proximity
    const eats = nx === fx && ny === fy
    const foodDist = Math.abs(nx - fx) + Math.abs(ny - fy)

    if (eats) {
      // Only eat if lookahead shows we survive afterwards
      const afterEatScore = scoreDirection(blocked, snake, di, depth + 5, true)
      if (afterEatScore >= snake.length) {
        score += 500000 // Bonus for safe eating
      } else {
        score -= 5000000 // Penalty: eating kills us
      }
    } else {
      // Mild food pursuit when safe
      if (lookaheadScore > snake.length * 3) {
        score -= foodDist * 50
      } else {
        score -= foodDist * 5
      }
    }

    // Tail proximity: keep close when space is tight
    const tailDist = Math.abs(nx - tx) + Math.abs(ny - ty)
    if (lookaheadScore < snake.length * 2) {
      score -= tailDist * 100 // Space is tight, stay near tail
    } else if (lookaheadScore < snake.length * 4) {
      score -= tailDist * 20
    }

    // Prefer center-ish positions (slight bias)
    const centerDist = Math.abs(nx - G / 2) + Math.abs(ny - G / 2)
    score -= centerDist * 2

    if (score > bestScore) {
      bestScore = score
      bestDir = DIRS[di]
    }
  }

  // Emergency: no direction passed lookahead, try simple flood fill
  if (bestScore === -Infinity) {
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
      if (blocked[ny * G + nx]) continue

      const simBlocked = new Uint8Array(blocked)
      if (!tailFrozen) {
        simBlocked[ty * G + tx] = 0
      }
      const space = floodFill(simBlocked, nx, ny)
      if (space > (bestScore === -Infinity ? 0 : -Infinity)) {
        bestScore = space
        bestDir = DIRS[di]
      }
    }
  }

  return bestDir
}
