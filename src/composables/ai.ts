import type { Direction, Position } from '../types/game'

const G = 20
const GX2 = G * G
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]
const DIRS: Direction[] = ['up', 'right', 'down', 'left']

// BFS flood fill
function floodFill(blocked: Uint8Array, sx: number, sy: number): number {
  const vis = new Uint8Array(GX2)
  const qx = new Int32Array(GX2), qy = new Int32Array(GX2)
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
 * BFS lookahead: at each step, expand top-K branches only.
 * Avoids exponential blowup.
 *
 * Each branch tracks: (hx, hy, px, py, blocked)
 *   - hx,hy = current head
 *   - px,py = previous tail position (to unblock when moving without eating)
 *
 * Returns best reachable space after `steps` simulated moves.
 */
function lookaheadBFS(
  blocked: Uint8Array,
  startHX: number,
  startHY: number,
  steps: number,
): number {
  const TOP_K = 3

  // Branch: head pos + prev tail pos + blocked snapshot
  interface Branch { hx: number; hy: number; px: number; py: number; b: Uint8Array }

  const init: Branch = { hx: startHX, hy: startHY, px: -1, py: -1, b: new Uint8Array(blocked) }
  let branches: Branch[] = [init]

  const next: Branch[] = []

  for (let step = 0; step < steps; step++) {
    next.length = 0

    for (const br of branches) {
      for (let d = 0; d < 4; d++) {
        const nx = br.hx + DX[d], ny = br.hy + DY[d]
        if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
        if (br.b[ny * G + nx]) continue

        const nb = new Uint8Array(br.b)
        nb[ny * G + nx] = 1            // new head blocked
        if (br.px >= 0) nb[br.py * G + br.px] = 0  // old tail freed

        next.push({ hx: nx, hy: ny, px: br.hx, py: br.hy, b: nb })
      }
    }

    if (next.length === 0) return 0

    // Score and keep top K
    for (const b of next) {
      (b as any)._s = floodFill(b.b, b.hx, b.hy)
    }
    next.sort((a, b) => (b as any)._s - (a as any)._s)

    branches = next.slice(0, TOP_K)
  }

  let best = 0
  for (const br of branches) {
    const s = floodFill(br.b, br.hx, br.hy)
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
  const blocked = new Uint8Array(GX2)
  const bodyEnd = tailFrozen ? snake.length : snake.length - 1
  for (let i = 0; i < bodyEnd; i++) blocked[snake[i].y * G + snake[i].x] = 1
  for (const o of obstacles) blocked[o.y * G + o.x] = 1

  // Adaptive depth
  const ratio = snake.length / (GX2 - obstacles.length)
  const depth = ratio > 0.3 ? 25 : ratio > 0.15 ? 20 : 12

  let bestDir: Direction = 'right'
  let bestScore = -Infinity

  for (let di = 0; di < 4; di++) {
    const nx = hx + DX[di], ny = hy + DY[di]
    if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
    if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
    if (blocked[ny * G + nx]) continue

    // Quick space check
    const quick = new Uint8Array(blocked)
    if (!tailFrozen) quick[ty * G + tx] = 0
    if (floodFill(quick, nx, ny) < snake.length) continue

    // Prepare lookahead blocked grid (tail freed if not frozen)
    const look = new Uint8Array(blocked)
    if (!tailFrozen) look[ty * G + tx] = 0

    const futureSpace = lookaheadBFS(look, nx, ny, depth)
    if (futureSpace === 0) continue

    let score = futureSpace * 1000

    const eats = nx === fx && ny === fy
    const foodDist = Math.abs(nx - fx) + Math.abs(ny - fy)

    if (eats) {
      // Post-eat check: tail stays (frozen), head extends
      const eatBlock = new Uint8Array(blocked)
      eatBlock[ny * G + nx] = 1
      const postEat = lookaheadBFS(eatBlock, nx, ny, Math.min(depth, 12))
      score += postEat >= snake.length + 2 ? 500000 : -5000000
    } else {
      score -= foodDist * (futureSpace > snake.length * 3 ? 50 : 5)
    }

    // Tail following
    const tailDist = Math.abs(nx - tx) + Math.abs(ny - ty)
    if (futureSpace < snake.length * 2) score -= tailDist * 100
    else if (futureSpace < snake.length * 4) score -= tailDist * 20

    // Slight center bias
    score -= (Math.abs(nx - G / 2) + Math.abs(ny - G / 2)) * 2

    if (score > bestScore) { bestScore = score; bestDir = DIRS[di] }
  }

  // Emergency fallback
  if (bestScore === -Infinity) {
    let maxS = -1
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di]
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
      if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue
      if (blocked[ny * G + nx]) continue
      const s = floodFill(blocked, nx, ny)
      if (s > maxS) { maxS = s; bestDir = DIRS[di] }
    }
  }

  return bestDir
}
