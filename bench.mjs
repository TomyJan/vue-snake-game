// Snake AI Benchmark - exact copy of ai.ts logic
const G = 20;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const dirs = ['up', 'right', 'down', 'left'];

function floodFill(blocked, sx, sy) {
  const vis = new Uint8Array(G * G);
  const qx = new Int32Array(G * G), qy = new Int32Array(G * G);
  let h = 0, t = 0;
  if (blocked[sy * G + sx]) return 0;
  vis[sy * G + sx] = 1; qx[t] = sx; qy[t] = sy; t++;
  let cnt = 1;
  while (h < t) {
    const cx = qx[h], cy = qy[h]; h++;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue;
      const idx = ny * G + nx;
      if (vis[idx] || blocked[idx]) continue;
      vis[idx] = 1; qx[t] = nx; qy[t] = ny; t++; cnt++;
    }
  }
  return cnt;
}

function findSafeDirection(snake, food, tailFrozen) {
  if (snake.length === 0) return 'right';
  const hx = snake[0].x, hy = snake[0].y;
  const fx = food.x, fy = food.y;
  const tx = snake[snake.length - 1].x, ty = snake[snake.length - 1].y;

  const blocked = new Uint8Array(G * G);
  const bodyEnd = tailFrozen ? snake.length : snake.length - 1;
  for (let i = 0; i < bodyEnd; i++) blocked[snake[i].y * G + snake[i].x] = 1;

  let bestDir = 'right', bestScore = -Infinity;

  for (let di = 0; di < 4; di++) {
    const nx = hx + DX[di], ny = hy + DY[di];
    if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue;
    if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue;
    if (blocked[ny * G + nx]) continue;

    const eats = nx === fx && ny === fy;
    const nextLen = eats ? snake.length + 1 : snake.length;

    const simBlocked = new Uint8Array(blocked);
    if (!eats) simBlocked[ty * G + tx] = 0;

    const space = floodFill(simBlocked, nx, ny);
    if (space < nextLen) continue;

    let score = 0;
    if (eats && space >= nextLen) score += 10000000;
    else if (eats) score -= 1000000;
    score -= (Math.abs(nx - fx) + Math.abs(ny - fy)) * 50;
    score += space * 3;
    if (space < nextLen * 2) score -= (Math.abs(nx - tx) + Math.abs(ny - ty)) * 40;

    if (score > bestScore) { bestScore = score; bestDir = dirs[di]; }
  }

  if (bestScore === -Infinity) {
    for (let di = 0; di < 4; di++) {
      const nx = hx + DX[di], ny = hy + DY[di];
      if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue;
      if (snake.length > 1 && nx === snake[1].x && ny === snake[1].y) continue;
      if (!blocked[ny * G + nx]) return dirs[di];
    }
  }
  return bestDir;
}

function spawnFood(snake) {
  for (let a = 0; a < 200; a++) {
    const pos = { x: Math.floor(Math.random() * G), y: Math.floor(Math.random() * G) };
    if (!snake.some(s => s.x === pos.x && s.y === pos.y)) return pos;
  }
  return { x: 0, y: 0 };
}

const DIR_MAP = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
const RUNS = 50, MAX_MOVES = 10000;
let scores = [], lengths = [];

for (let run = 0; run < RUNS; run++) {
  let snake = [{x:10,y:10}, {x:9,y:10}, {x:8,y:10}];
  let food = spawnFood(snake);
  let score = 0, tailFrozen = false;

  for (let move = 0; move < MAX_MOVES; move++) {
    const dir = findSafeDirection(snake, food, tailFrozen);
    const delta = DIR_MAP[dir];
    const head = { x: snake[0].x + delta.x, y: snake[0].y + delta.y };

    if (head.x < 0 || head.x >= G || head.y < 0 || head.y >= G) break;
    if (snake.some((s, i) => {
      if (i === 0) return false;
      if (i === snake.length - 1 && !tailFrozen) return false;
      return s.x === head.x && s.y === head.y;
    })) break;

    const ate = head.x === food.x && head.y === food.y;
    snake.unshift(head);
    if (ate) { score += 10; tailFrozen = true; food = spawnFood(snake); }
    else { snake.pop(); tailFrozen = false; }
  }
  scores.push(score);
  lengths.push(snake.length);
}

scores.sort((a, b) => a - b);
const avg = scores.reduce((a, b) => a + b, 0) / RUNS;
console.log(`=== Benchmark (${RUNS} runs) ===`);
console.log(`Avg: ${avg.toFixed(0)} | Median: ${scores[Math.floor(RUNS/2)]} | Min: ${scores[0]} | Max: ${scores[RUNS-1]}`);
console.log(`Avg len: ${(lengths.reduce((a,b)=>a+b,0)/RUNS).toFixed(1)} | Max len: ${Math.max(...lengths)}`);
console.log(avg >= 2000 ? '✅ PASS' : avg >= 500 ? '⚠️ MARGINAL' : '❌ FAIL');
