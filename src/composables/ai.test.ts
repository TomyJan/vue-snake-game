import { describe, it, expect } from 'vitest'
import { findSafeDirection, analyzeRoom } from './ai'
import type { Position } from '../types/game'

/** Classic odd-length 1-wide horizontal spur to the left of an open head. */
function oddRowSpurBoard() {
  const obstacles: Position[] = []
  for (let x = 0; x <= 8; x++) {
    obstacles.push({ x, y: 9 })
    obstacles.push({ x, y: 11 })
  }
  obstacles.push({ x: 0, y: 10 })
  const snake: Position[] = [
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 13, y: 10 },
    { x: 14, y: 10 },
  ]
  const food: Position = { x: 18, y: 2 }
  return { snake, obstacles, food }
}

describe('snake AI — odd spur / fake exit', () => {
  it('strips odd 1-wide spur from effective space', () => {
    const { snake, obstacles } = oddRowSpurBoard()
    const q = analyzeRoom(snake, obstacles, false)
    expect(q.space).toBeGreaterThan(q.effective)
    // left corridor cells (1..8,10) are a dead spur of length 8 (even) or
    // include dead-end structure; effective must not count them as full free room
    expect(q.spurCells + q.oddSpurLen).toBeGreaterThan(0)
  })

  it('does not step into the left odd/fake corridor when safer exits exist', () => {
    const { snake, obstacles, food } = oddRowSpurBoard()
    const dir = findSafeDirection(snake, food, obstacles, false)
    expect(dir).not.toBe('left')
  })

  it('never returns reverse into neck on open board', () => {
    const snake: Position[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]
    const dir = findSafeDirection(snake, { x: 15, y: 10 }, [], false)
    expect(dir).not.toBe('left')
  })
})
