import type { Position } from '../types/game'

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
  // Fallback: find first empty cell
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
