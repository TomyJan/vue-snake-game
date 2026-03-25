export interface Position {
  x: number
  y: number
}

export type FoodType = 'normal' | 'bonus' | 'slow'

export interface Food {
  pos: Position
  type: FoodType
  expiresAt?: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

export interface GameState {
  snake: Position[]
  food: Food
  obstacles: Position[]
  direction: Direction
  nextDirection: Direction
  score: number
  highScore: number
  status: GameStatus
  speed: number
  particles: Particle[]
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
  bonusFood: string
  bonusGlow: string
  slowFood: string
  slowGlow: string
  obstacle: string
  text: string
  accent: string
  danger: string
  card: string
  cardBorder: string
}
