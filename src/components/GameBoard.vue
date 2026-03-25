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
import type { Position } from '../types/game'
import { GAME_CONFIG, DARK_THEME, LIGHT_THEME } from '../utils/constants'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  snake: Position[]
  food: Position
  status: string
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

  // Food with glow
  const foodX = props.food.x * cellSize + cellSize / 2
  const foodY = props.food.y * cellSize + cellSize / 2
  const pulse = 0.8 + 0.2 * Math.sin(now / 200)
  const foodRadius = (cellSize / 2 - 2) * pulse

  // Glow
  ctx.shadowColor = colors.foodGlow
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2)
  ctx.fillStyle = colors.food
  ctx.fill()
  ctx.shadowBlur = 0

  // Snake
  props.snake.forEach((seg, i) => {
    const x = seg.x * cellSize
    const y = seg.y * cellSize
    const pad = i === 0 ? 1 : 2
    const size = cellSize - pad * 2

    // Gradient from head to tail
    const ratio = i / Math.max(props.snake.length - 1, 1)
    if (i === 0) {
      ctx.fillStyle = colors.snakeHead
    } else if (ratio < 0.5) {
      ctx.fillStyle = colors.snakeBody
    } else {
      ctx.fillStyle = colors.snakeTail
    }

    // Rounded rectangle for segments
    const radius = i === 0 ? 6 : 4
    ctx.beginPath()
    ctx.roundRect(x + pad, y + pad, size, size, radius)
    ctx.fill()

    // Eyes on head
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

  // Paused overlay
  if (props.status === 'paused') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, canvasSize.value, canvasSize.value)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', canvasSize.value / 2, canvasSize.value / 2)
  }
}

let animFrame = 0
function animate() {
  draw()
  animFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
})

// Redraw when snake or food changes
watch(() => [props.snake, props.food, props.status], () => {
  draw()
}, { deep: true })
</script>

<style scoped>
.game-canvas {
  border-radius: 12px;
  border: 2px solid var(--card-border);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  display: block;
}
</style>
