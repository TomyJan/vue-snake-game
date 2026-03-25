# 🐍 Vue Snake Game

A modern Snake game built with Vue 3, TypeScript, and Vite.

## 🤖 Origin

This project was **entirely developed by AI** using [OpenClaw](https://github.com/openclaw/openclaw) with the **Xiaomi MiMo** model (`openrouter/xiaomi/mimo-v2-pro`).

- No human wrote any code
- Requirements, architecture, implementation, and documentation were all AI-generated
- Built autonomously in a single session

## Features

- 🎮 Classic snake gameplay with smooth canvas rendering
- ⌨️ Keyboard controls (Arrow keys + WASD)
- 📱 Mobile touch controls (D-pad)
- 🏆 Score system with localStorage high score persistence
- ⚡ Speed increases as score grows
- 🌗 Dark/Light theme toggle
- 🔊 Sound effects (Web Audio API)
- ⏸️ Pause/Resume functionality
- 🎨 Food glow animation + snake gradient coloring
- 📐 Responsive layout

## Quick Start

```bash
pnpm install
pnpm dev
```

Then open http://localhost:2333/

## Controls

| Key | Action |
|-----|--------|
| ↑↓←→ / WASD | Move |
| Space | Start / Pause |
| R | Restart |
| Esc | Pause |

## Tech Stack

- **Vue 3** (Composition API + `<script setup>`)
- **TypeScript**
- **Vite**
- **Canvas 2D API**
- **Web Audio API**
- **CSS Variables** (theme system)

## Project Structure

```
src/
├── components/       # Vue components
│   ├── GameBoard.vue
│   ├── ScoreBoard.vue
│   ├── GameControls.vue
│   ├── GameOverModal.vue
│   └── MobileControls.vue
├── composables/      # useGame, useTheme, useSound
├── types/            # TypeScript definitions
├── utils/            # Constants, helpers
├── App.vue           # Root component
├── main.ts           # Entry point
└── style.css         # Global styles
```

## License

MPL-2.0
