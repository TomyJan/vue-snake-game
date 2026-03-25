import type { GameConfig, ThemeConfig, Direction, Position } from '../types/game'

export const GAME_CONFIG: GameConfig = {
  gridSize: 20,
  cellSize: 24,
  initialSpeed: 200,
  speedIncrement: 5,
  maxSpeed: 80,
  initialLength: 3,
}

export const SPEED_LEVELS = [
  { label: 'Slow', speed: 280 },
  { label: 'Normal', speed: 200 },
  { label: 'Fast', speed: 130 },
  { label: 'Insane', speed: 80 },
] as const

export const DIRECTION_MAP: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const KEY_DIRECTION_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
}

export const OBSTACLE_COUNT = 8

export const DARK_THEME: ThemeConfig = {
  background: '#0a0a0a',
  gridBg: '#111111',
  gridLine: '#1a1a1a',
  snakeHead: '#00ff88',
  snakeBody: '#00cc6a',
  snakeTail: '#00994d',
  food: '#ff4444',
  foodGlow: 'rgba(255, 68, 68, 0.4)',
  bonusFood: '#ffd700',
  bonusGlow: 'rgba(255, 215, 0, 0.5)',
  slowFood: '#4488ff',
  slowGlow: 'rgba(68, 136, 255, 0.4)',
  obstacle: '#555555',
  text: '#ffffff',
  accent: '#00ff88',
  danger: '#ff4444',
  card: '#1a1a1a',
  cardBorder: '#2a2a2a',
}

export const LIGHT_THEME: ThemeConfig = {
  background: '#f0f0f0',
  gridBg: '#ffffff',
  gridLine: '#e0e0e0',
  snakeHead: '#00aa55',
  snakeBody: '#008844',
  snakeTail: '#006633',
  food: '#ee2222',
  foodGlow: 'rgba(238, 34, 34, 0.3)',
  bonusFood: '#cc9900',
  bonusGlow: 'rgba(204, 153, 0, 0.4)',
  slowFood: '#3366cc',
  slowGlow: 'rgba(51, 102, 204, 0.3)',
  obstacle: '#999999',
  text: '#1a1a1a',
  accent: '#00aa55',
  danger: '#ee2222',
  card: '#ffffff',
  cardBorder: '#dddddd',
}
