import type { Direction, Position } from '../types/game'

/**
 * Snake AI for 20×20 with static obstacles.
 *
 * 1) Take food only if EVERY intermediate state along the shortest food
 *    path still keeps head→tail connectivity (replan-safe), and post-eat
 *    still keeps connectivity.
 * 2) Otherwise pick a legal step that keeps head→tail, maximizing
 *    free space + tail-path length + mobility (with mild food pull).
 */

const G = 20
const N = G * G
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

const deadly = new Uint8Array(N)
const deadly2 = new Uint8Array(N)
const vis = new Uint8Array(N)
const prev = new Int32Array(N)
const q = new Int32Array(N)

function cell(x: number, y: number) {
  return y * G + x
}

function inGrid(x: number, y: number) {
  return x >= 0 && x < G && y >= 0 && y < G
}

function dirOf(from: Position, to: Position): Direction {
  if (to.y < from.y) return 'up'
  if (to.x > from.x) return 'right'
  if (to.y > from.y) return 'down'
  return 'left'
}

function copySnake(snake: Position[]) {
  return snake.map((p) => ({ x: p.x, y: p.y }))
}

function fillDeadly(snake: Position[], obstacles: Position[], frozen: boolean, buf: Uint8Array) {
  buf.fill(0)
  const end = frozen ? snake.length : snake.length - 1
  for (let i = 0; i < end; i++) buf[cell(snake[i].x, snake[i].y)] = 1
  for (const o of obstacles) buf[cell(o.x, o.y)] = 1
}

function legal(snake: Position[], obstacles: Position[], frozen: boolean): Position[] {
  fillDeadly(snake, obstacles, frozen, deadly)
  const h = snake[0]
  const neck = snake.length > 1 ? snake[1] : null
  const out: Position[] = []
  for (let d = 0; d < 4; d++) {
    const nx = h.x + DX[d]
    const ny = h.y + DY[d]
    if (!inGrid(nx, ny)) continue
    if (neck && nx === neck.x && ny === neck.y) continue
    if (deadly[cell(nx, ny)]) continue
    out.push({ x: nx, y: ny })
  }
  return out
}

function flood(buf: Uint8Array, sx: number, sy: number): number {
  const s = cell(sx, sy)
  if (buf[s]) return 0
  vis.fill(0)
  let head = 0
  let tail = 0
  vis[s] = 1
  q[tail++] = s
  let count = 1
  while (head < tail) {
    const cur = q[head++]
    const cx = cur % G
    const cy = (cur / G) | 0
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      if (!inGrid(nx, ny)) continue
      const ni = cell(nx, ny)
      if (vis[ni] || buf[ni]) continue
      vis[ni] = 1
      q[tail++] = ni
      count++
    }
  }
  return count
}

/** Path from start to target (cells after start). targetOpen: treat target free. */
function bfs(
  buf: Uint8Array,
  start: Position,
  target: Position,
  targetOpen: boolean,
): Position[] | null {
  const si = cell(start.x, start.y)
  const ti = cell(target.x, target.y)
  if (si === ti) return []

  prev.fill(-1)
  vis.fill(0)
  let head = 0
  let tail = 0
  vis[si] = 1
  q[tail++] = si

  const saved = buf[ti]
  if (targetOpen) buf[ti] = 0

  while (head < tail) {
    const cur = q[head++]
    if (cur === ti) break
    const cx = cur % G
    const cy = (cur / G) | 0
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      if (!inGrid(nx, ny)) continue
      const ni = cell(nx, ny)
      if (vis[ni] || buf[ni]) continue
      vis[ni] = 1
      prev[ni] = cur
      q[tail++] = ni
    }
  }
  if (targetOpen) buf[ti] = saved
  if (!vis[ti]) return null

  const path: Position[] = []
  let cur = ti
  while (cur !== si) {
    path.push({ x: cur % G, y: (cur / G) | 0 })
    cur = prev[cur]
  }
  path.reverse()
  return path
}

function prepSearch(snake: Position[], obstacles: Position[], frozen: boolean, buf: Uint8Array) {
  fillDeadly(snake, obstacles, frozen, buf)
  const h = snake[0]
  const t = snake[snake.length - 1]
  buf[cell(h.x, h.y)] = 0
  if (!frozen) buf[cell(t.x, t.y)] = 0
  return { head: h, tail: t }
}

function reachTail(snake: Position[], obstacles: Position[], frozen: boolean): boolean {
  const { head, tail } = prepSearch(snake, obstacles, frozen, deadly)
  return bfs(deadly, head, tail, true) !== null
}

function spaceOf(snake: Position[], obstacles: Position[], frozen: boolean): number {
  const { head } = prepSearch(snake, obstacles, frozen, deadly)
  return flood(deadly, head.x, head.y)
}

function tailPathLen(snake: Position[], obstacles: Position[], frozen: boolean): number {
  const { head, tail } = prepSearch(snake, obstacles, frozen, deadly)
  const p = bfs(deadly, head, tail, true)
  return p ? p.length : -1
}

function advance(
  snake: Position[],
  food: Position,
  _frozen: boolean,
  next: Position,
): { snake: Position[]; frozen: boolean; ate: boolean } {
  const ns = copySnake(snake)
  ns.unshift({ x: next.x, y: next.y })
  const ate = next.x === food.x && next.y === food.y
  if (!ate) ns.pop()
  return { snake: ns, frozen: ate, ate }
}

/**
 * Food path is replan-safe iff after every step we still reach tail.
 * (AI re-plans every tick; intermediate dead-ends would cause drift into traps.)
 */
function safeFoodFirst(
  snake: Position[],
  food: Position,
  obstacles: Position[],
  frozen: boolean,
): Position | null {
  const { head } = prepSearch(snake, obstacles, frozen, deadly)
  const path = bfs(deadly, head, food, false)
  if (!path || path.length === 0) return null

  let s = copySnake(snake)
  let fr = frozen
  for (let i = 0; i < path.length; i++) {
    const r = advance(s, food, fr, path[i])
    s = r.snake
    fr = r.frozen
    if (!reachTail(s, obstacles, fr)) {
      // allow pure huge space only post-eat
      if (!(r.ate && spaceOf(s, obstacles, fr) >= s.length + 12)) return null
    }
  }
  if (!fr) return null

  // Late game: demand residual room after eat
  if (snake.length >= 100) {
    const sp = spaceOf(s, obstacles, fr)
    if (sp < Math.floor(snake.length * 0.3)) return null
  }

  return path[0]
}

function evaluate(
  snake: Position[],
  food: Position,
  obstacles: Position[],
  frozen: boolean,
  ate: boolean,
): number {
  const len = snake.length
  const rt = reachTail(snake, obstacles, frozen)
  const space = spaceOf(snake, obstacles, frozen)
  const tpl = tailPathLen(snake, obstacles, frozen)
  const moves = legal(snake, obstacles, frozen)

  if (!rt && space < len + 12) return -1e12

  let score = 0
  if (rt) score += 5_000_000 + Math.max(tpl, 0) * 800
  else score -= 2_000_000

  score += space * 400
  score += moves.length * 5000

  const h = snake[0]
  const fd = Math.abs(h.x - food.x) + Math.abs(h.y - food.y)
  if (rt && space > len * 2 && moves.length >= 2) score -= fd * 90
  else if (rt && space > len * 1.3) score -= fd * 25
  else score -= fd * 3

  if (moves.length <= 1) score -= 80_000
  if (space < len + 3) score -= 100_000

  if (ate) score += rt ? 25_000 : -3_000_000

  // 1-ply: children that keep tail
  let kids = 0
  for (const m of moves) {
    const r = advance(snake, food, frozen, m)
    if (reachTail(r.snake, obstacles, r.frozen)) kids++
  }
  score += kids * 8000

  return score
}

export function findSafeDirection(
  snake: Position[],
  food: Position,
  obstacles: Position[],
  tailFrozen: boolean,
): Direction {
  if (snake.length === 0) return 'right'

  const head = snake[0]
  const moves = legal(snake, obstacles, tailFrozen)
  if (moves.length === 0) return 'right'

  const foodStep = safeFoodFirst(snake, food, obstacles, tailFrozen)
  if (foodStep) return dirOf(head, foodStep)

  // Prefer moves that keep tail reachability
  const keep = moves.filter((m) => {
    const r = advance(snake, food, tailFrozen, m)
    return reachTail(r.snake, obstacles, r.frozen)
  })
  const pool = keep.length > 0 ? keep : moves

  let best = pool[0]
  let bestScore = -Infinity
  for (const m of pool) {
    const r = advance(snake, food, tailFrozen, m)
    const sc = evaluate(r.snake, food, obstacles, r.frozen, r.ate)
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }

  // Follow longest-ish tail path when desperate
  if (keep.length === 0) {
    const { head: h, tail } = prepSearch(snake, obstacles, tailFrozen, deadly2)
    const tp = bfs(deadly2, h, tail, true)
    if (tp && tp.length > 0) {
      const step0 = tp[0]
      if (moves.some((m) => m.x === step0.x && m.y === step0.y)) return dirOf(head, step0)
    }
  }

  return dirOf(head, best)
}
