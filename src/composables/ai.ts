import type { Direction, Position } from '../types/game'

/**
 * Snake AI for 20×20 with static obstacles.
 *
 * Root issue (user-reported): when "leaving an exit", the AI keeps an
 * odd-length 1-wide row/column that flood-fill counts as free space but
 * is useless (parity trap). Fix: compute *effective* free space by
 * stripping 1-wide dead-end spurs (especially odd-length) out of the
 * head component before scoring.
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
const spurMark = new Uint8Array(N)
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
  /** raw flood-fill count */
  space: number
  /** space after stripping 1-wide dead-end spurs (esp. odd) */
  effective: number
  /** cells belonging to dead-end 1-wide spurs */
  spurCells: number
  /** number of odd-length spurs */
  oddSpurs: number
  /** sum of odd spur lengths */
  oddSpurLen: number
  deadEnds: number
  thin: number
  wideCells: number
}

/**
 * Effective free space = head component minus unusable 1-wide spurs.
 *
 * A spur is a chain starting at a degree-1 free cell and walking only
 * through degree-2 corridor cells until a junction (deg≥3) or end.
 * Entire spur is NOT real escape room for a long snake; odd length is
 * especially useless (parity).
 */
function roomQuality(snake: Position[], obstacles: Position[], frozen: boolean): RoomQ {
  const empty: RoomQ = {
    space: 0,
    effective: 0,
    spurCells: 0,
    oddSpurs: 0,
    oddSpurLen: 0,
    deadEnds: 0,
    thin: 0,
    wideCells: 0,
  }
  const { head } = prepSearch(snake, obstacles, frozen, deadly)
  const start = cell(head.x, head.y)
  if (deadly[start]) return empty

  // Collect head-reachable free component
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
  let wideCells = 0
  for (let i = 0; i < nRegion; i++) {
    const cur = region[i]
    const dcount = deg[cur]
    if (dcount <= 1) deadEnds++
    else if (dcount === 2) {
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
    } else wideCells++
  }

  // Mark spur cells: walk from each dead-end through deg-2 corridor
  spurMark.fill(0)
  seenThin.fill(0)
  let spurCells = 0
  let oddSpurs = 0
  let oddSpurLen = 0

  for (let i = 0; i < nRegion; i++) {
    const startC = region[i]
    if (deg[startC] !== 1) continue
    if (seenThin[startC]) continue

    // Don't treat the snake's own head as a "spur start" if it's the only deg-1
    // and it's the search origin — still ok to analyze chains from true pockets.

    const path: number[] = []
    let cur = startC
    let prevC = -1
    let hitJunction = false
    while (true) {
      if (seenThin[cur] && path.length > 0) break
      seenThin[cur] = 1
      path.push(cur)

      const cx = cur % G
      const cy = (cur / G) | 0
      let next = -1
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]
        const ny = cy + DY[d]
        if (!inGrid(nx, ny)) continue
        const ni = cell(nx, ny)
        if (deadly[ni]) continue
        if (ni === prevC) continue
        next = ni
        // prefer single continuation
      }
      // recount free neighbors excluding prev
      let freeN = 0
      let only = -1
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]
        const ny = cy + DY[d]
        if (!inGrid(nx, ny)) continue
        const ni = cell(nx, ny)
        if (deadly[ni]) continue
        if (ni === prevC) continue
        freeN++
        only = ni
      }
      next = freeN === 1 ? only : -1

      if (next < 0) break
      if (deg[next] >= 3) {
        hitJunction = true
        break
      }
      // continue into corridor (deg 2) or another dead-end
      if (deg[next] <= 2) {
        prevC = cur
        cur = next
        if (path.length > 60) break
        continue
      }
      break
    }

    // Spur = dead-end chain that ends at junction or is a pure dead pocket
    // Strip ALL cells of such 1-wide chains from effective space.
    // Exception: if path includes the head and is the only way (we're already in it),
    // still strip distal spur cells beyond head? Keep simple: strip whole spur if
    // it doesn't contain the head, or if it does contain head only strip the part
    // distal from head toward the dead end (not the path out).
    const headInPath = path.includes(start)
    if (!headInPath) {
      for (const c of path) {
        if (!spurMark[c]) {
          spurMark[c] = 1
          spurCells++
        }
      }
      if (path.length % 2 === 1) {
        oddSpurs++
        oddSpurLen += path.length
      }
    } else {
      // Head is on the spur: only mark cells from dead-end up to (not including) head
      // as useless distal pocket; cells from head outward may be the real exit.
      const headIdx = path.indexOf(start)
      // path starts at dead-end; headIdx is toward junction
      for (let k = 0; k < headIdx; k++) {
        const c = path[k]
        if (!spurMark[c]) {
          spurMark[c] = 1
          spurCells++
        }
      }
      const distalLen = headIdx
      if (distalLen > 0 && distalLen % 2 === 1) {
        oddSpurs++
        oddSpurLen += distalLen
      }
      void hitJunction
    }
  }

  const space = nRegion
  // HARD strip: effective space does not count spur cells at all
  // Odd spurs get an extra virtual penalty of their full length again
  const effective = Math.max(0, space - spurCells - oddSpurLen)

  return {
    space,
    effective,
    spurCells,
    oddSpurs,
    oddSpurLen,
    deadEnds,
    thin,
    wideCells,
  }
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
  // Must have real (spur-stripped) room after eat
  if (snake.length >= 30) {
    if (qAfter.effective < Math.max(8, Math.floor(snake.length * 0.2))) return null
    if (qAfter.oddSpurs > 0 && qAfter.effective < snake.length * 0.35) return null
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

  if (!rt && rq.effective < len + 8) return -1e12

  let score = 0
  if (rt) score += 5_000_000 + Math.max(tpl, 0) * 800
  else score -= 2_000_000

  // Score EFFECTIVE space only — raw space that includes odd spurs is a lie
  score += rq.effective * 900
  score += rq.wideCells * 300
  score += rq.space * 20 // tiny raw credit

  // Explicit anti-fake-exit
  score -= rq.spurCells * 6000
  score -= rq.oddSpurs * 40_000
  score -= rq.oddSpurLen * 8000
  score -= rq.deadEnds * 2000
  score -= Math.max(0, rq.thin - rq.wideCells) * 1500

  score += moves.length * 5000

  const h = snake[0]
  const fd = Math.abs(h.x - food.x) + Math.abs(h.y - food.y)
  if (rt && rq.effective > len * 1.5 && moves.length >= 2) score -= fd * 90
  else if (rt && rq.effective > len * 1.1) score -= fd * 25
  else score -= fd * 3

  if (moves.length <= 1) score -= 80_000
  if (rq.effective < len + 3) score -= 150_000

  if (ate) score += rt ? 25_000 : -3_000_000

  let kids = 0
  for (const m of moves) {
    const r = advance(snake, food, frozen, m)
    if (!reachTail(r.snake, obstacles, r.frozen)) continue
    const cq = roomQuality(r.snake, obstacles, r.frozen)
    if (cq.effective >= Math.min(r.snake.length, 8) && cq.oddSpurs === 0) kids++
    else if (cq.effective >= Math.min(r.snake.length, 8)) kids += 0.3 as unknown as number
  }
  // keep integer
  score += Math.floor(kids) * 9000

  return score
}

/** Prefer moves that reduce odd-spur inventory / don't create new ones. */
function spurDelta(
  before: RoomQ,
  after: RoomQ,
): number {
  // positive = worse
  return (
    (after.oddSpurs - before.oddSpurs) * 100 +
    (after.oddSpurLen - before.oddSpurLen) * 20 +
    (after.spurCells - before.spurCells) * 5 -
    (after.effective - before.effective)
  )
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

  const before = roomQuality(snake, obstacles, tailFrozen)

  const keep = moves.filter((m) => {
    const r = advance(snake, food, tailFrozen, m)
    return reachTail(r.snake, obstacles, r.frozen)
  })
  let pool = keep.length > 0 ? keep : moves

  // Among keepers: prefer moves that do not increase odd spurs when alternatives exist
  if (pool.length > 1) {
    const scored = pool.map((m) => {
      const r = advance(snake, food, tailFrozen, m)
      const after = roomQuality(r.snake, obstacles, r.frozen)
      return { m, after, delta: spurDelta(before, after) }
    })
    const bestDelta = Math.min(...scored.map((s) => s.delta))
    // allow near-best deltas only
    const filtered = scored.filter((s) => s.delta <= bestDelta + 5).map((s) => s.m)
    if (filtered.length > 0) pool = filtered

    // hard: if some move has 0 odd spurs after, drop those that create odd spurs
    const noOdd = scored.filter((s) => s.after.oddSpurs === 0).map((s) => s.m)
    if (noOdd.length > 0) {
      const keepNoOdd = noOdd.filter((m) => pool.some((p) => p.x === m.x && p.y === m.y))
      if (keepNoOdd.length > 0) pool = keepNoOdd
    }
  }

  let best = pool[0]
  let bestScore = -Infinity
  for (const m of pool) {
    const r = advance(snake, food, tailFrozen, m)
    let sc = evaluate(r.snake, food, obstacles, r.frozen, r.ate)
    const after = roomQuality(r.snake, obstacles, r.frozen)
    sc -= spurDelta(before, after) * 500
    if (after.oddSpurs > before.oddSpurs) sc -= 200_000
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
