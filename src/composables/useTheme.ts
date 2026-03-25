import { ref, watchEffect } from 'vue'
import type { Theme, ThemeConfig } from '../types/game'
import { DARK_THEME, LIGHT_THEME } from '../utils/constants'

const THEME_KEY = 'snake-theme'

export function useTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null
  const theme = ref<Theme>(savedTheme || 'dark')

  const colors: ThemeConfig = theme.value === 'dark' ? DARK_THEME : LIGHT_THEME

  watchEffect(() => {
    const t = theme.value === 'dark' ? DARK_THEME : LIGHT_THEME
    const root = document.documentElement
    root.style.setProperty('--bg', t.background)
    root.style.setProperty('--grid-bg', t.gridBg)
    root.style.setProperty('--grid-line', t.gridLine)
    root.style.setProperty('--snake-head', t.snakeHead)
    root.style.setProperty('--snake-body', t.snakeBody)
    root.style.setProperty('--snake-tail', t.snakeTail)
    root.style.setProperty('--food', t.food)
    root.style.setProperty('--food-glow', t.foodGlow)
    root.style.setProperty('--text', t.text)
    root.style.setProperty('--accent', t.accent)
    root.style.setProperty('--danger', t.danger)
    root.style.setProperty('--card', t.card)
    root.style.setProperty('--card-border', t.cardBorder)
    localStorage.setItem(THEME_KEY, theme.value)
  })

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme, colors }
}
