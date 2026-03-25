export interface Position {
  x: number
  y: number
}

export interface GameState {
  snake: Position[]
  food: Position
  direction: Direction
  nextDirection: Direction
  score: number
  highScore: number
  status: GameStatus
  speed: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'
export type GameStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'gameover'

export interface GameConfig {
  gridSize: number
  cellSize: number
  initialSpeed: number
  speedIncrement: number
  maxSpeed: number
  initialLength: number
}

export type SpeedLevel = 'slow' | 'normal' | 'fast' | 'insane'

export type Theme = 'dark' | 'light'

export interface ThemeConfig {
  background: string
  gridBg: string
  gridLine: string
  snakeHead: string
  snakeBody: string
  snakeTail: string
  food: string
  foodGlow: string
  text: string
  accent: string
  danger: string
  card: string
  cardBorder: string
}
