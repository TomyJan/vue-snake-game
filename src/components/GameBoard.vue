<template>
  <canvas
    ref="canvasRef"
    :width="canvasSize"
    :height="canvasSize"
    class="game-canvas"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import type { Position, Food, Particle } from '../types/game'
import { GAME_CONFIG, DARK_THEME, LIGHT_THEME } from '../utils/constants'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  snake: Position[]
  food: Food
  obstacles: Position[]
  particles: Particle[]
  status: string
  score?: number
  highScore?: number
  isNewHighScore?: boolean
}>()

const { theme } = useTheme()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasSize = computed(() => GAME_CONFIG.gridSize * GAME_CONFIG.cellSize)

function getColors() {
  return theme.value === 'dark' ? DARK_THEME : LIGHT_THEME
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const colors = getColors()
  const { cellSize, gridSize } = GAME_CONFIG
  const now = Date.now()

  // Clear
  ctx.fillStyle = colors.gridBg
  ctx.fillRect(0, 0, canvasSize.value, canvasSize.value)

  // Grid lines
  ctx.strokeStyle = colors.gridLine
  ctx.lineWidth = 0.5
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cellSize, 0)
    ctx.lineTo(i * cellSize, canvasSize.value)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * cellSize)
    ctx.lineTo(canvasSize.value, i * cellSize)
    ctx.stroke()
  }

  // Obstacles
  for (const obs of props.obstacles) {
    const x = obs.x * cellSize
    const y = obs.y * cellSize
    ctx.fillStyle = colors.obstacle
    ctx.beginPath()
    ctx.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 4)
    ctx.fill()
    // Cross pattern
    ctx.strokeStyle = colors.gridBg
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + 6, y + 6)
    ctx.lineTo(x + cellSize - 6, y + cellSize - 6)
    ctx.moveTo(x + cellSize - 6, y + 6)
    ctx.lineTo(x + 6, y + cellSize - 6)
    ctx.stroke()
  }

  // Food
  if (props.food && props.food.pos && props.status !== 'idle') {
    const foodX = props.food.pos.x * cellSize + cellSize / 2
    const foodY = props.food.pos.y * cellSize + cellSize / 2
    const pulse = 0.8 + 0.2 * Math.sin(now / 200)
    const foodRadius = (cellSize / 2 - 2) * pulse

    let foodColor = colors.food
    let glowColor = colors.foodGlow

    if (props.food.type === 'bonus') {
      foodColor = colors.bonusFood
      glowColor = colors.bonusGlow
    } else if (props.food.type === 'slow') {
      foodColor = colors.slowFood
      glowColor = colors.slowGlow
    }

    ctx.shadowColor = glowColor
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2)
    ctx.fillStyle = foodColor
    ctx.fill()
    ctx.shadowBlur = 0

    // Label
    if (props.food.type === 'bonus') {
      ctx.fillStyle = '#000'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('×3', foodX, foodY)
    } else if (props.food.type === 'slow') {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('❄', foodX, foodY)
    }

    // Timer for bonus food
    if (props.food.expiresAt) {
      const remaining = Math.max(0, props.food.expiresAt - now)
      const pct = remaining / 8000
      if (pct < 0.5 && pct > 0) {
        ctx.strokeStyle = foodColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(foodX, foodY, foodRadius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct)
        ctx.stroke()
      }
    }
  }

  // Snake
  if (props.snake.length > 0) {
    props.snake.forEach((seg, i) => {
      const x = seg.x * cellSize
      const y = seg.y * cellSize
      const pad = i === 0 ? 1 : 2
      const size = cellSize - pad * 2

      const ratio = i / Math.max(props.snake.length - 1, 1)
      if (i === 0) ctx.fillStyle = colors.snakeHead
      else if (ratio < 0.5) ctx.fillStyle = colors.snakeBody
      else ctx.fillStyle = colors.snakeTail

      const radius = i === 0 ? 6 : 4
      ctx.beginPath()
      ctx.roundRect(x + pad, y + pad, size, size, radius)
      ctx.fill()

      if (i === 0) {
        ctx.fillStyle = colors.gridBg
        const eyeSize = 3
        ctx.beginPath()
        ctx.arc(x + cellSize * 0.3, y + cellSize * 0.35, eyeSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + cellSize * 0.7, y + cellSize * 0.35, eyeSize, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }

  // Particles
  for (const p of props.particles) {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Overlays - semi-transparent, game state still visible underneath
  if (props.status === 'paused') {
    drawOverlay(ctx, '⏸ PAUSED', 'Press Space to resume')
  } else if (props.status === 'starting') {
    drawOverlay(ctx, '🐍 GET READY!', 'Use arrow keys or WASD to move')
  } else if (props.status === 'idle') {
    drawOverlay(ctx, '🐍 SNAKE', 'Press Space to start')
  } else if (props.status === 'gameover') {
    drawGameOver(ctx)
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, subtitle?: string) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(0, 0, canvasSize.value, canvasSize.value)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, canvasSize.value / 2, canvasSize.value / 2 - (subtitle ? 14 : 0))
  if (subtitle) {
    ctx.font = '14px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.fillText(subtitle, canvasSize.value / 2, canvasSize.value / 2 + 18)
  }
}

function drawGameOver(ctx: CanvasRenderingContext2D) {
  const c = getColors()
  const w = canvasSize.value
  const cx = w / 2

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, 0, w, w)

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('💀 Game Over', cx, cx - 50)

  // Score
  ctx.font = '16px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText('SCORE', cx, cx - 16)
  ctx.font = 'bold 36px "Courier New", monospace'
  ctx.fillStyle = c.accent
  ctx.fillText(String(props.score ?? 0), cx, cx + 22)

  // New high score
  if (props.isNewHighScore) {
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = c.accent
    ctx.fillText('🎉 New High Score!', cx, cx + 52)
  }

  // Length & best
  ctx.font = '13px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  const best = props.highScore ?? 0
  ctx.fillText(`Best: ${best}`, cx, cx + 78)
}

let animFrame = 0
function animate() { draw(); animFrame = requestAnimationFrame(animate) }
onMounted(() => animate())
onUnmounted(() => cancelAnimationFrame(animFrame))
watch(() => [props.snake, props.food, props.obstacles, props.particles, props.status], () => draw(), { deep: true })
</script>

<style scoped>
.game-canvas {
  border-radius: 12px;
  border: 2px solid var(--card-border);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  display: block;
  max-width: 95vw;
  max-height: 60vh;
  width: 480px;
  height: 480px;
}

@media (max-width: 500px) {
  .game-canvas {
    width: calc(100vw - 24px);
    height: calc(100vw - 24px);
    max-height: none;
  }
}
</style>
