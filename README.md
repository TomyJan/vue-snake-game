# 🐍 Vue Snake Game

A modern Snake game built with Vue 3, TypeScript, and Vite.

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
├── composables/      # useGame, useTheme, useSound
├── types/            # TypeScript definitions
├── utils/            # Constants, helpers
├── App.vue           # Root component
├── main.ts           # Entry point
└── style.css         # Global styles
```
