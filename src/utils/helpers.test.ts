import { describe, it, expect } from 'vitest'
import { randomPosition, positionsEqual, clampSpeed, spawnFood, generateObstacles } from './helpers'

describe('helpers', () => {
  describe('positionsEqual', () => {
    it('returns true for same position', () => {
      expect(positionsEqual({ x: 3, y: 5 }, { x: 3, y: 5 })).toBe(true)
    })

    it('returns false for different positions', () => {
      expect(positionsEqual({ x: 3, y: 5 }, { x: 3, y: 6 })).toBe(false)
      expect(positionsEqual({ x: 3, y: 5 }, { x: 4, y: 5 })).toBe(false)
    })
  })

  describe('randomPosition', () => {
    it('returns position within grid', () => {
      for (let i = 0; i < 50; i++) {
        const pos = randomPosition(10)
        expect(pos.x).toBeGreaterThanOrEqual(0)
        expect(pos.x).toBeLessThan(10)
        expect(pos.y).toBeGreaterThanOrEqual(0)
        expect(pos.y).toBeLessThan(10)
      }
    })

    it('excludes occupied positions', () => {
      const exclude = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]
      for (let i = 0; i < 20; i++) {
        const pos = randomPosition(5, exclude)
        expect(exclude.some((e) => positionsEqual(e, pos))).toBe(false)
      }
    })
  })

  describe('clampSpeed', () => {
    it('decreases speed as score increases', () => {
      const config = { initialSpeed: 200, speedIncrement: 5, maxSpeed: 80 }
      expect(clampSpeed(0, config)).toBe(200)
      expect(clampSpeed(50, config)).toBe(195)
      expect(clampSpeed(100, config)).toBe(190)
    })

    it('clamps to max speed', () => {
      const config = { initialSpeed: 200, speedIncrement: 5, maxSpeed: 80 }
      expect(clampSpeed(2000, config)).toBe(80)
    })
  })

  describe('spawnFood', () => {
    it('creates food at valid position', () => {
      const snake = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]
      const food = spawnFood(10, snake, [])
      expect(food.pos.x).toBeGreaterThanOrEqual(0)
      expect(food.pos.x).toBeLessThan(10)
      expect(snake.some((s) => positionsEqual(s, food.pos))).toBe(false)
    })

    it('has valid food type', () => {
      const food = spawnFood(10, [], [])
      expect(['normal', 'bonus', 'slow']).toContain(food.type)
    })
  })

  describe('generateObstacles', () => {
    it('generates correct count', () => {
      const obstacles = generateObstacles(20, [{ x: 10, y: 10 }], { x: 5, y: 5 }, 8)
      expect(obstacles.length).toBe(8)
    })

    it('does not place obstacles on snake or food', () => {
      const snake = [{ x: 10, y: 10 }]
      const food = { x: 5, y: 5 }
      const obstacles = generateObstacles(20, snake, food, 8)
      for (const obs of obstacles) {
        expect(positionsEqual(obs, snake[0])).toBe(false)
        expect(positionsEqual(obs, food)).toBe(false)
      }
    })
  })
})
