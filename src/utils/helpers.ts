import type { Position, FoodType, Food } from '../types/game'

export function randomPosition(
  gridSize: number,
  exclude: Position[] = []
): Position {
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

export function clampSpeed(score: number, config: {
  initialSpeed: number
  speedIncrement: number
  maxSpeed: number
}): number {
  const speed = config.initialSpeed - Math.floor(score / 50) * config.speedIncrement
  return Math.max(speed, config.maxSpeed)
}

export function randomFoodType(): FoodType {
  const r = Math.random()
  if (r < 0.1) return 'bonus'   // 10% chance
  if (r < 0.18) return 'slow'   // 8% chance
  return 'normal'
}

export function spawnFood(
  gridSize: number,
  snake: Position[],
  obstacles: Position[]
): Food {
  const exclude = [...snake, ...obstacles]
  const pos = randomPosition(gridSize, exclude)
  const type = randomFoodType()
  const expiresAt = type === 'bonus' ? Date.now() + 8000 : undefined
  return { pos, type, expiresAt }
}

export function generateObstacles(
  gridSize: number,
  snake: Position[],
  food: Position,
  count: number
): Position[] {
  const obstacles: Position[] = []
  const exclude: Position[] = [...snake, food]
  // Keep center clear for snake start
  const cx = Math.floor(gridSize / 2)
  const cy = Math.floor(gridSize / 2)
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      exclude.push({ x: cx + dx, y: cy + dy })
    }
  }
  for (let i = 0; i < count; i++) {
    const pos = randomPosition(gridSize, [...exclude, ...obstacles])
    obstacles.push(pos)
  }
  return obstacles
}
