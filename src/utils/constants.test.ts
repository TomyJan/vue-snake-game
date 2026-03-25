import { describe, it, expect } from 'vitest'
import {
  DIRECTION_MAP,
  OPPOSITE_DIRECTION,
  KEY_DIRECTION_MAP,
  GAME_CONFIG,
  SPEED_LEVELS,
} from './constants'

describe('constants', () => {
  describe('DIRECTION_MAP', () => {
    it('maps directions to correct deltas', () => {
      expect(DIRECTION_MAP.up).toEqual({ x: 0, y: -1 })
      expect(DIRECTION_MAP.down).toEqual({ x: 0, y: 1 })
      expect(DIRECTION_MAP.left).toEqual({ x: -1, y: 0 })
      expect(DIRECTION_MAP.right).toEqual({ x: 1, y: 0 })
    })
  })

  describe('OPPOSITE_DIRECTION', () => {
    it('maps each direction to its opposite', () => {
      expect(OPPOSITE_DIRECTION.up).toBe('down')
      expect(OPPOSITE_DIRECTION.down).toBe('up')
      expect(OPPOSITE_DIRECTION.left).toBe('right')
      expect(OPPOSITE_DIRECTION.right).toBe('left')
    })
  })

  describe('KEY_DIRECTION_MAP', () => {
    it('maps arrow keys to directions', () => {
      expect(KEY_DIRECTION_MAP['ArrowUp']).toBe('up')
      expect(KEY_DIRECTION_MAP['ArrowDown']).toBe('down')
      expect(KEY_DIRECTION_MAP['ArrowLeft']).toBe('left')
      expect(KEY_DIRECTION_MAP['ArrowRight']).toBe('right')
    })

    it('maps WASD to directions', () => {
      expect(KEY_DIRECTION_MAP['w']).toBe('up')
      expect(KEY_DIRECTION_MAP['a']).toBe('left')
      expect(KEY_DIRECTION_MAP['s']).toBe('down')
      expect(KEY_DIRECTION_MAP['d']).toBe('right')
    })
  })

  describe('GAME_CONFIG', () => {
    it('has valid grid size', () => {
      expect(GAME_CONFIG.gridSize).toBeGreaterThan(0)
      expect(GAME_CONFIG.cellSize).toBeGreaterThan(0)
    })

    it('has valid speed range', () => {
      expect(GAME_CONFIG.initialSpeed).toBeGreaterThan(GAME_CONFIG.maxSpeed)
    })
  })

  describe('SPEED_LEVELS', () => {
    it('has decreasing speed values', () => {
      for (let i = 1; i < SPEED_LEVELS.length; i++) {
        expect(SPEED_LEVELS[i].speed).toBeLessThan(SPEED_LEVELS[i - 1].speed)
      }
    })

    it('each level has label and speed', () => {
      for (const level of SPEED_LEVELS) {
        expect(level.label).toBeTruthy()
        expect(level.speed).toBeGreaterThan(0)
      }
    })
  })
})
