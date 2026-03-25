# 🐍 Vue Snake Game

A modern Snake game built with Vue 3 + TypeScript, entirely developed by AI ([OpenClaw](https://github.com/openclaw/openclaw) + Xiaomi MiMo).

🎮 **Play:** https://tomyjan.github.io/vue-snake-game/

## Features

- 🎮 Classic snake gameplay with smooth Canvas 2D rendering
- ⌨️ Keyboard controls (Arrow keys + WASD)
- 📱 Mobile floating joystick (touch anywhere to activate)
- 🏆 Score system with localStorage high score persistence
- 🤖 AI auto-play with flood fill algorithm
- ⚡ 4 speed levels (Slow / Normal / Fast / Insane)
- 🟡 Bonus food (×3 points, time-limited)
- 🔵 Slow food (❄ temporary speed reduction)
- 🧱 Random obstacles per game
- ✨ Particle effects on eating
- 🌗 Dark / Light theme toggle
- 🔊 Sound effects (Web Audio API)
- 📐 Responsive mobile layout with viewport lock

## Controls

| Key | Action |
|-----|--------|
| ↑↓←→ / WASD | Move |
| Space | Start / Pause |
| R | Restart |
| Q | Quit to menu |
| Esc | Pause |
| 🤖 | Toggle AI auto-play |

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (port 2333)
pnpm dev

# Run all checks (typecheck + format + test + build)
pnpm ci

# Individual commands
pnpm typecheck      # TypeScript type checking
pnpm test           # Run tests (Vitest)
pnpm format         # Format code (Prettier)
pnpm format:check   # Check formatting
pnpm build          # Production build
```

## Project Structure

```
src/
├── components/
│   ├── GameBoard.vue        # Canvas rendering (snake, food, obstacles, particles)
│   ├── GameControls.vue     # Start/pause/end/speed/AI/theme/sound buttons
│   ├── MobileControls.vue   # Floating touch joystick
│   └── ScoreBoard.vue       # Score display panel
├── composables/
│   ├── useGame.ts           # Game logic + AI (flood fill solver)
│   ├── useTheme.ts          # Dark/light theme (CSS variables)
│   └── useSound.ts          # Web Audio API sound effects
├── utils/
│   ├── constants.ts         # Game config, direction maps, themes
│   ├── helpers.ts           # Random position, food spawning, obstacles
│   ├── helpers.test.ts      # Unit tests for helpers
│   ├── constants.test.ts    # Unit tests for constants
│   └── leaderboard.ts       # GitHub Issues API leaderboard
├── types/
│   └── game.ts              # TypeScript interfaces
├── App.vue                  # Root component
├── main.ts                  # Entry point
├── style.css                # Global styles
└── env.d.ts                 # Vite type declarations
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript |
| Build | Vite |
| Rendering | Canvas 2D API |
| Audio | Web Audio API |
| Styling | CSS Variables |
| Testing | Vitest + jsdom |
| Formatting | Prettier |
| CI/CD | GitHub Actions → GitHub Pages |

## AI Algorithm

The AI uses a **flood fill scoring** approach:

1. For each valid direction, simulate the move
2. After eating: include tail in blocked set (snake grows)
3. After normal move: free tail, add new head
4. Flood fill counts reachable space from new position
5. Score = `space × 100 - distance_to_food` (for normal moves)
6. Score = `space × 100 + 5000` (for safe food eating)
7. Pick the direction with the highest score

## Deployment

Auto-deployed via GitHub Actions on every push to `main`:

1. **CI job**: typecheck → format check → test → build
2. **Deploy job**: upload `dist/` to GitHub Pages

## License

MPL-2.0
