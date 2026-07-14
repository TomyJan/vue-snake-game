import type { Direction, Position } from '../types/game'

/**
 * Snake AI for 20×20 with static obstacles.
 *
 * 1) Eat only if the whole shortest food path is replan-safe (head→tail
 *    after every step) and post-eat still has usable room.
 * 2) Detour among tail-preserving moves, maximizing *usable* free space —
 *    heavily penalize 1-wide / odd dead corridors that look like escapes
 *    but are traps.
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
const region = new Int32Array(N)
const deg = new Uint8Array(N)
const seenThin = new Uint8Array(N)

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

export type RoomQ = {
  space: number
  usable: number
  deadEnds: number
  thin: number
  corners: number
  oddTraps: number
  wideCells: number
}

/**
 * Free-region quality from the head.
 * Raw flood-fill counts 1-wide odd stubs as "space"; those are fake exits.
 */
function roomQuality(snake: Position[], obstacles: Position[], frozen: boolean): RoomQ {
  const empty: RoomQ = {
    space: 0,
    usable: 0,
    deadEnds: 0,
    thin: 0,
    corners: 0,
    oddTraps: 0,
    wideCells: 0,
  }
  const { head } = prepSearch(snake, obstacles, frozen, deadly)
  const start = cell(head.x, head.y)
  if (deadly[start]) return empty

  vis.fill(0)
  let h = 0
  let t = 0
  vis[start] = 1
  q[t++] = start
  let nRegion = 0
  region[nRegion++] = start

  while (h < t) {
    const cur = q[h++]
    const cx = cur % G
    const cy = (cur / G) | 0
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      if (!inGrid(nx, ny)) continue
      const ni = cell(nx, ny)
      if (vis[ni] || deadly[ni]) continue
      vis[ni] = 1
      q[t++] = ni
      region[nRegion++] = ni
    }
  }

  for (let i = 0; i < nRegion; i++) {
    const cur = region[i]
    const cx = cur % G
    const cy = (cur / G) | 0
    let dcount = 0
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      if (!inGrid(nx, ny)) continue
      if (!deadly[cell(nx, ny)]) dcount++
    }
    deg[cur] = dcount
  }

  let deadEnds = 0
  let thin = 0
  let corners = 0
  let wideCells = 0

  for (let i = 0; i < nRegion; i++) {
    const cur = region[i]
    const dcount = deg[cur]
    if (dcount <= 1) {
      deadEnds++
      continue
    }
    if (dcount === 2) {
      const cx = cur % G
      const cy = (cur / G) | 0
      const dirs: number[] = []
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]
        const ny = cy + DY[d]
        if (!inGrid(nx, ny)) continue
        if (deadly[cell(nx, ny)]) continue
        dirs.push(d)
      }
      if (dirs.length === 2 && (dirs[0] ^ dirs[1]) === 2) thin++
      else corners++
      continue
    }
    wideCells++
  }

  // Walk from dead-ends through 1-wide chains → odd spur length is useless
  seenThin.fill(0)
  let oddTraps = 0
  for (let i = 0; i < nRegion; i++) {
    const startC = region[i]
    if (deg[startC] !== 1) continue
    if (seenThin[startC]) continue

    let cur = startC
    let prevC = -1
    let length = 0
    while (true) {
      if (seenThin[cur]) break
      seenThin[cur] = 1
      length++

      const cx = cur % G
      const cy = (cur / G) | 0
      let next = -1
      let freeN = 0
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]
        const ny = cy + DY[d]
        if (!inGrid(nx, ny)) continue
        const ni = cell(nx, ny)
        if (deadly[ni]) continue
        freeN++
        if (ni !== prevC) next = ni
      }

      if (next < 0) break
      // hit a branch / open area
      if (deg[next] >= 3) break
      // continue only along degree-2 corridor or into another dead-end
      if (deg[next] === 2 || deg[next] === 1) {
        prevC = cur
        cur = next
        if (length > 50) break
        continue
      }
      break
    }

    if (length >= 1) {
      // odd-length 1-wide spur: classic fake escape row/col
      if (length % 2 === 1) oddTraps += length * 2
      else oddTraps += length
    }
  }

  const space = nRegion
  const usable = Math.max(
    0,
    space - deadEnds * 1.3 - thin * 1.15 - corners * 0.4 - oddTraps * 0.55,
  )

  return { space, usable, deadEnds, thin, corners, oddTraps, wideCells }
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
      if (!(r.ate && spaceOf(s, obstacles, fr) >= s.length + 12)) return null
    }
  }
  if (!fr) return null

  const qAfter = roomQuality(s, obstacles, fr)
  if (snake.length >= 35) {
    if (qAfter.usable < Math.max(10, Math.floor(snake.length * 0.18))) return null
    // trap pocket: mostly thin/dead structure
    if (
      qAfter.thin + qAfter.deadEnds > qAfter.wideCells + 3 &&
      qAfter.usable < snake.length * 0.4
    ) {
      return null
    }
  }
  if (snake.length >= 100 && qAfter.space < Math.floor(snake.length * 0.3)) return null

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
  const rq = roomQuality(snake, obstacles, frozen)
  const tpl = tailPathLen(snake, obstacles, frozen)
  const moves = legal(snake, obstacles, frozen)

  if (!rt && rq.space < len + 12) return -1e12

  let score = 0
  if (rt) score += 5_000_000 + Math.max(tpl, 0) * 800
  else score -= 2_000_000

  score += rq.usable * 750
  score += rq.wideCells * 400
  score += rq.space * 60

  score -= rq.deadEnds * 5000
  score -= rq.thin * 4200
  score -= rq.oddTraps * 2800
  score -= rq.corners * 800

  score += moves.length * 5000

  const h = snake[0]
  const fd = Math.abs(h.x - food.x) + Math.abs(h.y - food.y)
  if (rt && rq.usable > len * 1.6 && moves.length >= 2) score -= fd * 90
  else if (rt && rq.usable > len * 1.1) score -= fd * 25
  else score -= fd * 3

  if (moves.length <= 1) score -= 80_000
  if (rq.usable < len + 3) score -= 130_000
  if (rq.thin > rq.wideCells && rq.usable < len * 1.5) score -= 100_000

  if (ate) score += rt ? 25_000 : -3_000_000

  let kids = 0
  for (const m of moves) {
    const r = advance(snake, food, frozen, m)
    if (!reachTail(r.snake, obstacles, r.frozen)) continue
    const cq = roomQuality(r.snake, obstacles, r.frozen)
    if (cq.usable >= Math.min(r.snake.length, 8)) kids++
  }
  score += kids * 9000

  return score
}

/** True if step leaves the head in a thin-corridor / odd-trap pocket. */
function afterStepIsThinTrap(
  snake: Position[],
  food: Position,
  obstacles: Position[],
  frozen: boolean,
  next: Position,
): boolean {
  const r = advance(snake, food, frozen, next)
  const rq = roomQuality(r.snake, obstacles, r.frozen)

  fillDeadly(r.snake, obstacles, r.frozen, deadly2)
  const h = r.snake[0]
  deadly2[cell(h.x, h.y)] = 0
  let local = 0
  for (let d = 0; d < 4; d++) {
    const nx = h.x + DX[d]
    const ny = h.y + DY[d]
    if (!inGrid(nx, ny)) continue
    if (deadly2[cell(nx, ny)]) continue
    local++
  }

  if (local <= 1 && rq.thin + rq.deadEnds >= rq.wideCells) return true
  if (local <= 1 && rq.oddTraps >= 3) return true
  if (rq.oddTraps >= 5 && rq.wideCells <= 2 && rq.usable < r.snake.length + 6) return true
  return false
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

  const keep = moves.filter((m) => {
    const r = advance(snake, food, tailFrozen, m)
    return reachTail(r.snake, obstacles, r.frozen)
  })
  let pool = keep.length > 0 ? keep : moves

  // Prefer not entering 1-wide / odd dead corridors when wider options exist
  if (pool.length > 1) {
    const fat = pool.filter((m) => !afterStepIsThinTrap(snake, food, obstacles, tailFrozen, m))
    if (fat.length > 0) pool = fat
  }

  let best = pool[0]
  let bestScore = -Infinity
  for (const m of pool) {
    const r = advance(snake, food, tailFrozen, m)
    let sc = evaluate(r.snake, food, obstacles, r.frozen, r.ate)
    if (afterStepIsThinTrap(snake, food, obstacles, tailFrozen, m)) sc -= 180_000
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }

  if (keep.length === 0) {
    const { head: hh, tail } = prepSearch(snake, obstacles, tailFrozen, deadly2)
    const tp = bfs(deadly2, hh, tail, true)
    if (tp && tp.length > 0) {
      const step0 = tp[0]
      if (moves.some((m) => m.x === step0.x && m.y === step0.y)) return dirOf(head, step0)
    }
  }

  return dirOf(head, best)
}
